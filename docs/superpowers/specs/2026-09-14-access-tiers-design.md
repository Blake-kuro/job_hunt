# 三档访问配额（游客 / 免费 / PRO）设计

日期：2026-09-14
状态：已与用户确认
涉及仓库：后端 `job_hunt_back`（main，基线 ebeadb1）、前端 `job_hunt_front`（main，基线 3eb3eba）
前置：手机号验证码登录已完成（后端 `src/auth.ts`、`routes/auth.ts`；前端 `/login`、`meQuery`）。

## 1. 需求

| 档位 | 判定 | 岗位可见 | 题库可见 |
|---|---|---|---|
| `GUEST` | 用户没有 `PHONE` 身份 | 默认排序前 **20** 条 | 题库前 **20** 道 |
| `FREE` | 有 `PHONE` 身份且非 PRO | 前 **100** 条 | 前 **200** 道 |
| `PRO` | `plan = PRO` 且（`proExpiresAt` 为空 或 > 现在） | 全部 | 全部 |

口径：**可见范围**，不是计次。岗位可见集合 = 默认排序（`deadlineAt asc nulls last, createTime desc`）前 N 条的 id 集合，筛选 / 搜索 / 排序 / 分页在集合内进行（滚动的，随截止日变化）。题库可见集合 = `Question` 按 `id asc` 前 N 道。

不做：支付、订单；游客数据合并到已有账号；按 IP 限流。

## 2. 匿名用户（后端）

- Cookie `job_hunt_device`：32 字节 base64url 随机值，`httpOnly, sameSite=Lax, path=/api, maxAge=365 天, secure=production`。
- `AuthProvider` 枚举新增 `DEVICE`；游客 = `User` 一行 + `AuthIdentity{ provider: DEVICE, providerKey: <device id 的 sha256> }`。
- 中间件 `requestUser` 改为：
  1. 有有效会话 Cookie → 该用户；
  2. 否则有 `job_hunt_device` Cookie 且能找到 DEVICE 身份 → 该游客用户；
  3. 否则创建游客用户 + DEVICE 身份，`setCookie(job_hunt_device)`。
  每请求把 `c.var.userId` 与 `c.var.access`（见 §4）注入。
- `/api/openapi.json`、`/api/docs`、`/api/auth/*` 仍在中间件之前，不创建游客。
- **登录合并**（`verifyLoginCode`）：拿到当前请求的游客用户 `guestId`（若有）。若手机号无 `PHONE` 身份：把 `PHONE` 身份挂到 `guestId`（没有游客则新建用户），`name` 从"游客"改为 `用户XXXX`。若手机号已有身份：会话指向该用户，游客数据不动。`verifyLoginSms` 路由需读 device cookie 并传入。
- **退出登录**：删会话，**同时删除当前 device cookie 对应的 `DEVICE` 身份并清掉该 cookie**，下次访问生成全新游客。原因：登录时 PHONE 身份挂到了游客那行 User 上，若退出后仍按 device 找回同一行，它已有 PHONE 身份，档位会错判成 FREE。
- `getCurrentUser(userId)` 返回 `User` DTO 扩展：`tier`、`plan`、`proExpiresAt`。

## 3. 数据模型

```prisma
enum AuthProvider { PHONE WECHAT QQ DEVICE }
enum Plan { FREE PRO }

model User {
  ...
  plan         Plan      @default(FREE)
  proExpiresAt DateTime?
}
```
Migration `20260914120000_access_tiers`。

## 4. 档位计算与配额常量（后端 `src/lib/access.ts`）

```ts
export type Tier = "GUEST" | "FREE" | "PRO";
export const LIMITS: Record<Tier, { jobs: number | null; questions: number | null }> = {
  GUEST: { jobs: 20, questions: 20 },
  FREE: { jobs: 100, questions: 200 },
  PRO: { jobs: null, questions: null },
};
export function resolveTier(u: { plan; proExpiresAt; hasPhone: boolean }, now = new Date()): Tier
export interface Access { tier: Tier; jobs: number | null; questions: number | null }
```
`requestUser` 一次查询 `user + identities(provider)`，算出 `Access` 放入 `c.var.access`。

## 5. 服务层变化

- `listJobs(query, userId, access)`：若 `access.jobs !== null`，先 `findMany({ select: { id }, orderBy: 默认排序, take: access.jobs })` 得到 `visibleIds`，`where` 加 `id: { in: visibleIds }`。返回新增 `access: { tier, visible: access.jobs, total: count() 全库 }`（total 不受筛选影响，用于"共 N 条"）。
- `getProgress(userId)`：不变（收藏/投递是自己的）。
- `getTodayQuestion(userId, access)`：`where.id` 加 `{ in: visibleQuestionIds }`（`take: access.questions` 按 id asc）。返回新增 `exhausted: null | "QUOTA" | "ALL"`：`question` 为 null 时，若全库还有未答题 → `"QUOTA"`，否则 `"ALL"`。
- `submitAnswer(userId, questionId, picked, access)`：题不在可见集合 → `AppError(403, "FORBIDDEN", "当前档位不可作答此题")`。
- `getDashboard`：返回新增 `access`（同上形状，`visible: access.questions, total: question.count()`）。
- `listWrongBook / setMastered / listCompanySets`：不变。

## 6. 契约变化（`src/contract`）

- `TierSchema = z.enum(["GUEST","FREE","PRO"])`，`PlanSchema = z.enum(["FREE","PRO"])`。
- `AccessSchema = { tier, visible: int|null, total: int }`（`.openapi("Access")`）。
- `UserSchema` 新增 `tier: TierSchema, plan: PlanSchema, proExpiresAt: string|null`（ISO）。
- `JobListResultSchema` 新增 `access: AccessSchema`。
- `QuizTodaySchema` 新增 `exhausted: z.enum(["QUOTA","ALL"]).nullable()`。
- `QuizDashboardSchema` 新增 `access: AccessSchema`。
- `ApiErrorCodeSchema` 新增 `FORBIDDEN`；`AppError.status` 允许 403。
- `POST /api/quiz/attempts` 响应加 403。
- `/api/me` 不再有 401 场景（中间件保证总有用户）。

## 7. 手动开通命令（后端）

`scripts/set-plan.ts`：`pnpm set-plan <手机号> <FREE|PRO> [天数]`。按 PHONE 身份找用户；PRO + 天数 → `proExpiresAt = now + 天数`；PRO 无天数 → `proExpiresAt = null`（永久）；FREE → `plan=FREE, proExpiresAt=null`。打印结果。README 加说明。

## 8. 前端

- `src/api/types.ts` 加 `Tier / Access / User` 别名（生成物）。
- `routes/index.tsx`、`routes/practice.tsx`：删除 `beforeLoad` 的 401 跳转（保留 `meQuery` 预取供导航栏用）。`routes/login.tsx` 的"已登录则跳首页"改为 `tier !== "GUEST"` 判定。
- `Navbar`：`user.tier === "GUEST"` → 显示"登录"按钮（`Link to="/login"`）；否则账号菜单，菜单里显示档位标签（免费 / PRO · 到期日）。
- 新组件 `widgets/access-banner/AccessBanner.tsx`：props `{ access, kind: "jobs" | "questions" }`；`access.visible !== null && access.total > access.visible` 时渲染：GUEST →"未登录只能查看前 {visible} 条，登录后可看 {FREE 上限} 条" + 按钮"登录"；FREE →"免费账号可查看前 {visible} 条，共 {total} 条，升级 PRO 查看全部" + 按钮"了解 PRO"（`/pro`）。数字来自后端 `access`，FREE 上限前端写死常量 `{ jobs: 100, questions: 200 }`（与后端 LIMITS 一致，spec 注明双份）。
- 看板：分页区下方放 `AccessBanner`（`kind="jobs"`），只在当前页是最后一页时显示。
- 刷题：`today.exhausted === "QUOTA"` → 题目区渲染 `AccessBanner`（`kind="questions"`，`access` 取自 dashboard）；`"ALL"` → 现有"题库已答完"。
- 新路由 `/pro`（`routes/pro.tsx` + `views/pro/ProPage.tsx`）：三档权益表 + 文案"公司注册中，PRO 暂时通过微信联系开通：<占位>" + 当前档位。
- `useLogout`：成功后 `qc.clear()` 并 `navigate({ to: "/" })`（不再去登录页）。

## 9. 测试

- 后端：`lib/access.test.ts`（resolveTier 边界：过期 PRO → FREE，无手机 PRO → PRO）；`routes/jobs.test.ts` 新增用例：插入 25 条岗位，游客请求 `total=25, visible=20, items ≤ 20`，且筛选只在前 20 内；登录会话看到全部 25（< 100）。`routes/quiz.test.ts`：插入 22 道题，游客答完 20 道后 `exhausted: "QUOTA"`，对第 21 道 POST → 403；PRO 用户（测试直接改 plan）无限制。`routes/auth.test.ts`：游客先收藏一条岗位再登录，`/api/jobs` 里该岗位仍 `starred`；退出后 `/api/me` 为新的 GUEST。
- 前端：提示文案的纯函数 `accessMessage()` 3 个用例（vitest，不引入 DOM 测试库；`AccessBanner` 只是它的渲染壳）。

## 10. 验收

- 无 Cookie 首次访问 `/api/me` → 200 `tier: GUEST`，响应带 `Set-Cookie: job_hunt_device`。
- 游客看板底部提示"前 20 条"，登录后提示变"前 100 条"（数据 > 100 时）或消失；`pnpm set-plan <手机号> PRO` 后刷新提示消失，`/pro` 显示 PRO。
- 游客刷题答到第 21 道出现升级提示；登录后继续。
- 两仓库 typecheck / lint / test 全绿；`openapi.json` 与 `schema.d.ts` 同步。
