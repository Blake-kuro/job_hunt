# 三档访问配额 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 游客 / 免费 / PRO 三档：岗位可见前 20 / 100 / 全部，题库可见前 20 / 200 / 全部；游客用 device Cookie 匿名建档，登录时原地升级；PRO 手动开通。

**Architecture:** 后端 `requestUser` 保证每个请求都有 `userId`（会话 → device → 新建游客）并注入 `access`；service 用可见 id 集合限制查询；契约新增 `Access`、`User.tier/plan`、`QuizToday.exhausted`。前端去掉强制登录，按 `access` 渲染提示条与 `/pro` 页。

**Tech Stack:** 沿用（Hono + zod-openapi + Prisma 7；React + TanStack + openapi-fetch）。

**Spec:** `docs/superpowers/specs/2026-09-14-access-tiers-design.md`

## Global Constraints

- 后端 `/Users/black/Desktop/job_hunt_back`（`main`，基线 ebeadb1），前端 `/Users/black/Desktop/job_hunt_front`（分支 `feat/access-tiers`，基线 a2aa61d）。命令前缀 `source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && `；pnpm。提交尾行 `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`。
- 数据库 Docker :5433；`.env` 有 `DATABASE_URL`（dev）与 `TEST_DATABASE_URL`（`job_hunt_test`）。不碰 :5432；**:3001 上有用户自己的 tsx watch 进程，不要杀它**；自己验证时用 `PORT=3002`。
- 数字：GUEST jobs 20 / questions 20；FREE 100 / 200；PRO 无限。
- 契约：改了路由或 contract 必须 `pnpm openapi` 并提交 `openapi.json`（`pretest` 校验）；前端 `schema.d.ts` 由 `pnpm gen:api` 生成，不手改。
- 现有业务语义不变（端点、字段只增不改）；现有测试若因新增字段/档位需要调整，只允许最小改动并在报告说明。
- 日期只经 `src/lib/dates.ts`；错误格式 `{ error: { code, message, issues? } }`。
- 永不提交 `.env`、`src/generated`、`dist`。

---

### Task 1（后端）: 匿名用户、档位计算、登录合并、退出重置、`/api/me`、`set-plan`

**Files:**
- Modify: `prisma/schema.prisma`、`src/env.ts`、`src/auth.ts`、`src/services/users.ts`、`src/routes/auth.ts`、`src/routes/me.ts`（无改动，确认）、`src/contract/user.ts`、`src/contract/index.ts`、`src/test/db.ts`、`src/routes/auth.test.ts`、`src/routes/me.test.ts`、`package.json`、`README.md`
- Create: `prisma/migrations/<ts>_access_tiers/migration.sql`（由 `prisma migrate dev` 生成）、`src/lib/access.ts`、`src/lib/access.test.ts`、`src/contract/access.ts`、`scripts/set-plan.ts`

**Interfaces:**
- Produces: `Env.Variables = { userId: string; access: Access }`；`resolveTier / accessFor / LIMITS`（`src/lib/access.ts`）；`TierSchema / PlanSchema / AccessSchema`（`src/contract/access.ts`）；`User` DTO 新增 `tier, plan, proExpiresAt`；测试工具 `guestClient()`、`seedDevUser()`（带 PHONE 身份 → FREE）、`apiRequest()`（不变）。

- [ ] **Step 1: schema 与迁移**

`prisma/schema.prisma`：
```prisma
enum AuthProvider {
  PHONE
  WECHAT
  QQ
  DEVICE
}

enum Plan {
  FREE
  PRO
}
```
`model User` 加两行：
```prisma
  plan         Plan      @default(FREE)
  proExpiresAt DateTime?
```
```bash
pnpm exec prisma migrate dev --name access_tiers
cat prisma/migrations/*_access_tiers/migration.sql
```
Expected：SQL 含 `ALTER TYPE "AuthProvider" ADD VALUE 'DEVICE'`、`CREATE TYPE "Plan"`、`ALTER TABLE "User" ADD COLUMN "plan" ... DEFAULT 'FREE'`、`ADD COLUMN "proExpiresAt"`。同时把迁移应用到测试库：
```bash
DATABASE_URL="$TEST_DATABASE_URL" pnpm exec prisma migrate deploy
```
（`TEST_DATABASE_URL` 从 `.env` 读：`export $(grep TEST_DATABASE_URL .env)` 或直接粘贴值。）

- [ ] **Step 2: 失败测试 `src/lib/access.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { LIMITS, accessFor, resolveTier } from "./access";

const now = new Date("2026-09-14T00:00:00Z");

describe("resolveTier", () => {
  it("无手机号 → GUEST", () => {
    expect(resolveTier({ plan: "FREE", proExpiresAt: null, hasPhone: false }, now)).toBe("GUEST");
  });
  it("有手机号 → FREE", () => {
    expect(resolveTier({ plan: "FREE", proExpiresAt: null, hasPhone: true }, now)).toBe("FREE");
  });
  it("PRO 永久 / 未过期 → PRO，即使没有手机号", () => {
    expect(resolveTier({ plan: "PRO", proExpiresAt: null, hasPhone: false }, now)).toBe("PRO");
    expect(resolveTier({ plan: "PRO", proExpiresAt: new Date("2026-12-31T00:00:00Z"), hasPhone: true }, now)).toBe("PRO");
  });
  it("PRO 已过期 → 按手机号回落", () => {
    const expired = new Date("2026-01-01T00:00:00Z");
    expect(resolveTier({ plan: "PRO", proExpiresAt: expired, hasPhone: true }, now)).toBe("FREE");
    expect(resolveTier({ plan: "PRO", proExpiresAt: expired, hasPhone: false }, now)).toBe("GUEST");
  });
});

describe("accessFor", () => {
  it("带上档位与上限", () => {
    expect(accessFor("GUEST")).toEqual({ tier: "GUEST", jobs: 20, questions: 20 });
    expect(accessFor("FREE")).toEqual({ tier: "FREE", jobs: 100, questions: 200 });
    expect(accessFor("PRO")).toEqual({ tier: "PRO", jobs: null, questions: null });
    expect(LIMITS.FREE.questions).toBe(200);
  });
});
```

- [ ] **Step 3: `src/lib/access.ts`**

```ts
import type { Plan } from "../generated/prisma/enums";

export type Tier = "GUEST" | "FREE" | "PRO";

export interface Access {
  tier: Tier;
  /** 岗位可见条数；null = 无限制 */
  jobs: number | null;
  /** 题库可见道数；null = 无限制 */
  questions: number | null;
}

export const LIMITS: Record<Tier, { jobs: number | null; questions: number | null }> = {
  GUEST: { jobs: 20, questions: 20 },
  FREE: { jobs: 100, questions: 200 },
  PRO: { jobs: null, questions: null },
};

export function resolveTier(
  u: { plan: Plan; proExpiresAt: Date | null; hasPhone: boolean },
  now: Date = new Date(),
): Tier {
  if (u.plan === "PRO" && (u.proExpiresAt === null || u.proExpiresAt > now)) return "PRO";
  return u.hasPhone ? "FREE" : "GUEST";
}

export function accessFor(tier: Tier): Access {
  return { tier, ...LIMITS[tier] };
}
```
运行 `pnpm exec vitest run src/lib/access.test.ts` → 5 pass。

- [ ] **Step 4: 契约 `src/contract/access.ts` + `user.ts` + `index.ts`**

```ts
// access.ts
import { z } from "@hono/zod-openapi";

export const TierSchema = z.enum(["GUEST", "FREE", "PRO"]).openapi("Tier");
export type TierValue = z.infer<typeof TierSchema>;
export const PlanSchema = z.enum(["FREE", "PRO"]).openapi("Plan");

/** 当前档位对某类资源的可见范围 */
export const AccessSchema = z
  .object({
    tier: TierSchema,
    visible: z.number().int().nullable(),
    total: z.number().int(),
  })
  .openapi("Access");
export type AccessInfo = z.infer<typeof AccessSchema>;
```
```ts
// user.ts
import { z } from "@hono/zod-openapi";
import { PlanSchema, TierSchema } from "./access";

export const UserSchema = z
  .object({
    id: z.string(),
    email: z.string().nullable(),
    phone: z.string().nullable(),
    name: z.string(),
    tier: TierSchema,
    plan: PlanSchema,
    proExpiresAt: z.string().nullable(),
  })
  .openapi("User");
export type User = z.infer<typeof UserSchema>;
```
`index.ts` 加 `export * from "./access";`。

- [ ] **Step 5: `src/env.ts`**

```ts
import type { Access } from "./lib/access";

/** Hono 泛型：中间件注入的每请求变量 */
export type Env = { Variables: { userId: string; access: Access } };
```

- [ ] **Step 6: `src/services/users.ts`**

```ts
import type { User } from "../contract";
import { prisma } from "../db";
import { type Access, accessFor, resolveTier } from "../lib/access";

const userSelect = {
  id: true,
  email: true,
  name: true,
  plan: true,
  proExpiresAt: true,
  identities: { select: { provider: true, providerKey: true } },
} as const;

type UserRow = {
  id: string;
  email: string | null;
  name: string;
  plan: "FREE" | "PRO";
  proExpiresAt: Date | null;
  identities: { provider: string; providerKey: string }[];
};

function toAccess(row: UserRow): Access {
  return accessFor(
    resolveTier({
      plan: row.plan,
      proExpiresAt: row.proExpiresAt,
      hasPhone: row.identities.some((i) => i.provider === "PHONE"),
    }),
  );
}

export async function getAccess(userId: string): Promise<Access> {
  const row = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: userSelect });
  return toAccess(row);
}

export async function getCurrentUser(userId: string): Promise<User> {
  const row = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: userSelect });
  return {
    id: row.id,
    email: row.email,
    phone: row.identities.find((i) => i.provider === "PHONE")?.providerKey ?? null,
    name: row.name,
    tier: toAccess(row).tier,
    plan: row.plan,
    proExpiresAt: row.proExpiresAt ? row.proExpiresAt.toISOString() : null,
  };
}
```

- [ ] **Step 7: `src/auth.ts` —— 会话 / 游客 / 合并 / 退出**

在现有文件基础上：

新增常量与工具：
```ts
export const DEVICE_COOKIE = "job_hunt_device";
const DEVICE_TTL_SECONDS = 365 * 24 * 60 * 60;
const cookieOpts = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "Lax" as const, path: "/api" };
```

替换 `authenticatedUser` 与 `requestUser`：
```ts
type CookieContext = Parameters<typeof getCookie>[0];

/** 有效会话对应的 userId；过期会话顺手删掉 */
async function sessionUserId(c: CookieContext): Promise<string | null> {
  const token = getCookie(c, SESSION_COOKIE);
  if (!token) return null;
  const session = await prisma.session.findUnique({ where: { tokenHash: sha256(token) } });
  if (!session) return null;
  if (session.expiresAt <= new Date()) {
    await prisma.session.delete({ where: { tokenHash: session.tokenHash } });
    return null;
  }
  return session.userId;
}

/** device cookie 对应的游客 userId；没有或找不到 → null（不创建） */
export async function findDeviceUserId(c: CookieContext): Promise<string | null> {
  const device = getCookie(c, DEVICE_COOKIE);
  if (!device) return null;
  const identity = await prisma.authIdentity.findUnique({
    where: { provider_providerKey: { provider: "DEVICE", providerKey: sha256(device) } },
    select: { userId: true },
  });
  return identity?.userId ?? null;
}

/** 新建游客 + DEVICE 身份，并写 cookie */
async function createDeviceUser(c: Parameters<typeof setCookie>[0]): Promise<string> {
  const device = randomBytes(32).toString("base64url");
  const user = await prisma.user.create({
    data: { name: "游客", identities: { create: { provider: "DEVICE", providerKey: sha256(device) } } },
    select: { id: true },
  });
  setCookie(c, DEVICE_COOKIE, device, { ...cookieOpts, maxAge: DEVICE_TTL_SECONDS });
  return user.id;
}

/** 每个请求都有用户：会话 → 游客 → 新建游客；并注入档位 */
export const requestUser = createMiddleware<Env>(async (c, next) => {
  const userId = (await sessionUserId(c)) ?? (await findDeviceUserId(c)) ?? (await createDeviceUser(c));
  c.set("userId", userId);
  c.set("access", await getAccess(userId));
  await next();
});
```
（`getAccess` 从 `./services/users` 导入；删除 `getCurrentUser` 的导入若不再用。）

`verifyLoginCode(phone, code, guestUserId: string | null)`：把事务里"找/建身份"那段替换为：
```ts
    let identity = await tx.authIdentity.findUnique({
      where: { provider_providerKey: { provider: "PHONE", providerKey: phone } },
    });
    if (!identity) {
      // 手机号首次登录：优先挂到当前游客（其收藏/作答原地保留），否则新建用户
      const guest = guestUserId
        ? await tx.user.findFirst({
            where: { id: guestUserId, identities: { none: { provider: "PHONE" } } },
            select: { id: true },
          })
        : null;
      const userId = guest
        ? (await tx.user.update({ where: { id: guest.id }, data: { name: `用户${phone.slice(-4)}` }, select: { id: true } })).id
        : (await tx.user.create({ data: { name: `用户${phone.slice(-4)}` }, select: { id: true } })).id;
      identity = await tx.authIdentity.create({ data: { userId, provider: "PHONE", providerKey: phone } });
    }
```

`clearSession(c)` 整体替换：
```ts
/** 退出：删会话；同时销毁当前游客身份（否则已挂上手机号的那行会被按 device 找回、误判 FREE） */
export async function clearSession(c: Parameters<typeof deleteCookie>[0]) {
  const token = getCookie(c, SESSION_COOKIE);
  if (token) await prisma.session.deleteMany({ where: { tokenHash: sha256(token) } });
  deleteCookie(c, SESSION_COOKIE, cookieOpts);

  const device = getCookie(c, DEVICE_COOKIE);
  if (device) {
    const key = sha256(device);
    const identity = await prisma.authIdentity.findUnique({
      where: { provider_providerKey: { provider: "DEVICE", providerKey: key } },
      select: { id: true, userId: true },
    });
    if (identity) {
      await prisma.authIdentity.delete({ where: { id: identity.id } });
      // 纯游客（没有别的身份）连同数据一起删，避免孤儿行
      await prisma.user.deleteMany({ where: { id: identity.userId, identities: { none: {} } } });
    }
  }
  deleteCookie(c, DEVICE_COOKIE, cookieOpts);
}
```
`setSessionCookie` 改用 `{ ...cookieOpts, maxAge: SESSION_TTL_SECONDS }`。删除不再使用的 `authenticatedUser`。

- [ ] **Step 8: `src/routes/auth.ts` verify 处理器传入游客**

```ts
  .openapi(verifySms, async (c) => {
    const { phone, code } = c.req.valid("json");
    const guestId = await findDeviceUserId(c);
    const { token, userId } = await verifyLoginCode(phone, code, guestId);
    setSessionCookie(c, token);
    return c.json({ user: await getCurrentUser(userId) }, 200);
  })
```
`import { clearSession, findDeviceUserId, sendLoginCode, setSessionCookie, verifyLoginCode } from "../auth";`

- [ ] **Step 9: `scripts/set-plan.ts` + package.json 脚本 + README**

```ts
import "../src/load-env";
import { prisma } from "../src/db";

const [phone, plan, daysArg] = process.argv.slice(2);
if (!phone || (plan !== "FREE" && plan !== "PRO")) {
  console.error("用法：pnpm set-plan <手机号> <FREE|PRO> [天数]");
  process.exit(1);
}
const days = daysArg ? Number(daysArg) : null;
if (daysArg && (!Number.isInteger(days) || (days as number) <= 0)) {
  console.error("天数必须是正整数");
  process.exit(1);
}

const identity = await prisma.authIdentity.findUnique({
  where: { provider_providerKey: { provider: "PHONE", providerKey: phone } },
  select: { userId: true },
});
if (!identity) {
  console.error(`手机号 ${phone} 尚未登录过，没有对应用户`);
  process.exit(1);
}
const proExpiresAt = plan === "PRO" && days ? new Date(Date.now() + days * 86_400_000) : null;
const user = await prisma.user.update({
  where: { id: identity.userId },
  data: { plan, proExpiresAt },
  select: { id: true, name: true, plan: true, proExpiresAt: true },
});
console.log(`${user.name}（${phone}）→ ${user.plan}${user.proExpiresAt ? `，到期 ${user.proExpiresAt.toISOString().slice(0, 10)}` : plan === "PRO" ? "（永久）" : ""}`);
await prisma.$disconnect();
```
`package.json` scripts 加 `"set-plan": "tsx scripts/set-plan.ts"`。README "约定" 段末尾加：
```markdown
- 三档访问：游客（device Cookie 匿名建档）看岗位前 20 条 / 题库前 20 道；手机号登录后 100 条 / 200 道；PRO 无限制。手动开通：`pnpm set-plan <手机号> PRO [天数]`（不填天数为永久；`FREE` 取消）。
```

- [ ] **Step 10: 测试工具与测试**

`src/test/db.ts`：`seedDevUser` 改为带 PHONE 身份（→ FREE）：
```ts
  const user = await prisma.user.create({
    data: {
      email: DEV_USER_EMAIL,
      name: "开发账号",
      identities: { create: { provider: "PHONE", providerKey: "13800000000" } },
    },
  });
```
新增：
```ts
/** 带 cookie 罐的匿名客户端：自动回传 Set-Cookie（device / session） */
export function guestClient() {
  const jar = new Map<string, string>();
  return async (path: string, init: RequestInit = {}) => {
    const headers = new Headers(init.headers);
    if (jar.size) headers.set("cookie", [...jar].map(([k, v]) => `${k}=${v}`).join("; "));
    const res = await app.request(path, { ...init, headers });
    for (const line of res.headers.getSetCookie()) {
      const [pair, ...attrs] = line.split(";");
      const [k, v] = pair.split("=");
      if (attrs.some((a) => /max-age=0/i.test(a))) jar.delete(k.trim());
      else jar.set(k.trim(), v);
    }
    return res;
  };
}
```

`src/routes/auth.test.ts`：把"未登录不能访问受保护接口"改为：
```ts
  it("无 Cookie 访问 → 自动成为游客并下发 device cookie", async () => {
    const res = await app.request("/api/me");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ tier: "GUEST", phone: null, plan: "FREE" });
    expect(res.headers.getSetCookie().some((c) => c.startsWith("job_hunt_device="))).toBe(true);
  });
```
"验证码首次登录…" 用例里 `me` 的断言加 `tier: "FREE"`。新增两个用例：
```ts
  it("游客登录后原有收藏保留在同一用户上；退出后回到全新游客", async () => {
    await insertJobs(jobFixture(dateKey(), addDays));
    const guest = guestClient();
    expect((await guest("/api/jobs/1/favorite", { method: "PUT" })).status).toBe(200);
    const guestMe = (await (await guest("/api/me")).json()) as { id: string };

    const send = await guest("/api/auth/sms/send", post({ phone: "13700137000" }));
    const { developmentCode } = (await send.json()) as { developmentCode: string };
    const verify = await guest("/api/auth/sms/verify", post({ phone: "13700137000", code: developmentCode }));
    expect(verify.status).toBe(200);
    const me = (await (await guest("/api/me")).json()) as { id: string; tier: string };
    expect(me).toMatchObject({ id: guestMe.id, tier: "FREE" });
    const jobs = await (await guest("/api/jobs")).json();
    expect(jobs.items.find((j: { id: number }) => j.id === 1).starred).toBe(true);

    expect((await guest("/api/auth/logout", { method: "POST" })).status).toBe(204);
    const after = (await (await guest("/api/me")).json()) as { id: string; tier: string };
    expect(after.tier).toBe("GUEST");
    expect(after.id).not.toBe(guestMe.id);
  });

  it("手机号已属于别的账号时，游客登录切换到该账号，游客数据不合并", async () => {
    const first = guestClient();
    const s1 = await first("/api/auth/sms/send", post({ phone: "13600136000" }));
    await first("/api/auth/sms/verify", post({ phone: "13600136000", code: ((await s1.json()) as { developmentCode: string }).developmentCode }));
    const owner = (await (await first("/api/me")).json()) as { id: string };

    await insertJobs(jobFixture(dateKey(), addDays));
    const guest = guestClient();
    await guest("/api/jobs/2/favorite", { method: "PUT" });
    const s2 = await guest("/api/auth/sms/send", post({ phone: "13600136000" }));
    await guest("/api/auth/sms/verify", post({ phone: "13600136000", code: ((await s2.json()) as { developmentCode: string }).developmentCode }));
    const me = (await (await guest("/api/me")).json()) as { id: string };
    expect(me.id).toBe(owner.id);
    const jobs = await (await guest("/api/jobs")).json();
    expect(jobs.items.find((j: { id: number }) => j.id === 2).starred).toBe(false);
  });
```
（导入：`import { addDays, dateKey } from "../lib/dates"; import { guestClient, hasDb, insertJobs, jobFixture, resetDb } from "../test/db";`。注意第二个用例两次插入 fixture 会主键冲突——把 `insertJobs` 放到 `beforeEach` 里一次性插入，两个用例都不再各自插入。）

`src/routes/me.test.ts`："返回开发账号" 断言加 `tier: "FREE"`。

- [ ] **Step 11: 门禁**

```bash
pnpm openapi && pnpm typecheck && pnpm exec biome format --write . >/dev/null && pnpm lint && pnpm test
```
Expected：openapi 14 条路径不变但 `User` 组件多三个字段；测试 67 + 5 + 2 = **74 pass**（access 5 个 + auth 新增 2 个，原"未登录 401"用例改写）。若 quiz/jobs 现有测试因 `seedDevUser` 改动出现差异，最小修正并说明。

- [ ] **Step 12: 提交并推送**

```bash
git add -A && git commit -m "feat(auth): 游客匿名建档（device cookie）、档位计算、登录原地升级、退出重置游客；set-plan 手动开通" && git push origin main
```

---

### Task 2（后端）: 岗位 / 题库配额、契约字段、403、测试

> **接手说明（2026-09-14 追加）**：后端工作区里有另一会话（ChatGPT）未提交的"管理员 / 资料 / 课程 / 按内容授权"改动（`role/enabled`、`AccessGrant`、`StudyMaterial`、`Course`、`Question.published`、`routes/admin.ts`、`routes/content.ts`、`services/quiz.ts` 的 `questionAccess()`）。用户裁定：**三档配额为主，管理员授权是额外解锁**。本任务先把这批改动修到门禁全绿并单独提交，再实现配额。

- [ ] **Step 0: 接手并提交 ChatGPT 的改动（不改其功能）**

1. `pnpm typecheck` 当前报 `src/services/quiz.ts` 里 `findUnique({ where: { id: questionId, ...access } })` 类型错误 —— 改为 `findFirst`（本任务 Step 4 会重写该函数，这里只求过编译）。
2. `pnpm exec prisma migrate dev`（开发库应用 `20260914130000_admin_content`）；`DATABASE_URL="$TEST_DATABASE_URL" pnpm exec prisma migrate deploy`（测试库已应用过也无妨）。
3. `pnpm openapi`（新增 admin / content 路径与组件）；`pnpm exec biome format --write .`；`pnpm lint`（若 ChatGPT 的文件有 lint 错误，做最小机械修正并列出）。
4. `pnpm test` 全绿（74）。
5. 提交：`git commit -m "feat(admin): 管理员角色、资料 / 课程、按内容授权（接手另一会话的改动；修复 findUnique 类型错误，补 openapi.json）"`。**不推送**（本任务结束一起推）。

**Step 3–5 的规则调整（覆盖下文同名步骤中与之冲突的部分）**：

- 题库可见集合（`visibleQuestionIds(userId, access)`）= 满足 `published: true` 且（在档位窗口内 或 在该用户未过期的 `AccessGrant{ contentType: QUESTION }` 里）的题 id；`role === ADMIN` → 全部已发布题（返回 `null` 表示不限制）；`enabled === false` 的用户已被中间件 403，不用再管。档位窗口 = `published: true` 按 id 升序前 `access.questions` 道。实现为一次查询窗口 id + 一次查询 grants，合并去重。
- ChatGPT 的 `questionAccess()` 删除，`getTodayQuestion / submitAnswer / listWrongBook / getDashboard` 统一用新的 `visibleQuestionIds`（`listWrongBook` 保留"只列可见题"的过滤：`question: { id: { in: ids } }`，`null` 时不过滤）。
- `requestUser` 里 ChatGPT 加的 `enabled` 单独查询与 `getAccess` 重复：改为 `users.ts` 导出 `loadUserAccess(userId): Promise<{ access: Access; enabled: boolean; role: "STUDENT" | "ADMIN" }>`，一次查询；`requestUser` 用它，`Env.Variables` 增加 `role`。`getAccess` 保留（`loadUserAccess` 的薄包装）。
- `exhausted` 判定里"全库还有未答题"改为"**已发布**的题里还有未答的"。
- 测试：quiz 配额用例里的 "PRO 无限制" 要先把开发账号改成 `role: STUDENT`（`updateMany({ where: { email: DEV_USER_EMAIL }, data: { plan: "PRO", role: "STUDENT" } })`），否则走的是管理员分支；再加一个用例："FREE 学生被单独授权第 201 道后可以看到并作答它"（插入 202 道题太重 → 改为：`seedDevUser` 学生（把 role 改回 STUDENT）+ 插入 22 道题 + 把该学生 `plan` 保持 FREE 但通过 `LIMITS` 无法缩小……**简化**：对**游客**授权——游客 userId 可从 `/api/me` 拿到，插入 `AccessGrant{ userId: guestId, contentType: QUESTION, contentId: "qq-021", grantedById: 开发账号 id }`，然后游客 `/api/quiz/attempts` 提交 `qq-021` → 200，`dashboard.access.visible` 仍为 20（授权不改变档位数字）。
- 预期测试数：74 + jobs 2 + quiz 3 = **79**。



**Files:**
- Modify: `src/contract/common.ts`、`src/contract/job.ts`、`src/contract/quiz.ts`、`src/lib/errors.ts`、`src/services/jobs.ts`、`src/services/quiz.ts`、`src/routes/jobs.ts`、`src/routes/quiz.ts`、`src/routes/jobs.test.ts`、`src/routes/quiz.test.ts`、`openapi.json`

**Interfaces:**
- Consumes: `c.var.access`（Task 1）。
- Produces: `JobListResult.access`、`QuizToday.exhausted`、`QuizDashboard.access`、错误码 `FORBIDDEN`（403）。

- [ ] **Step 1: 契约**

`common.ts`：`ApiErrorCodeSchema` 枚举加 `"FORBIDDEN"`。`lib/errors.ts`：`AppError.status` 类型改 `400 | 401 | 403 | 429`。
`job.ts`：`import { AccessSchema } from "./access";`，`JobListResultSchema` 加 `access: AccessSchema`。
`quiz.ts`：`QuizTodaySchema` 加 `exhausted: z.enum(["QUOTA", "ALL"]).nullable()`；`QuizDashboardSchema` 加 `access: AccessSchema`。
`routes/quiz.ts` `attemptsRoute.responses` 加 `403: json(ApiErrorSchema, "当前档位不可作答")`。

- [ ] **Step 2: 失败测试**

`src/routes/jobs.test.ts` 新增（文件顶部 `import { guestClient } from "../test/db";`，并加一个造 25 条岗位的 helper）：
```ts
function manyJobs(n: number, todayKey: string, addDays: (k: string, d: number) => string): Prisma.JobCreateManyInput[] {
  return Array.from({ length: n }, (_, i) => ({
    id: 100 + i,
    categoryId: (i % 3) + 1,
    enterpriseName: `公司${String(i + 1).padStart(2, "0")}`,
    position: i % 2 === 0 ? "工程师" : "运营",
    workLocation: i % 2 === 0 ? "北京" : "上海",
    deadline: addDays(todayKey, i + 1),
    deadlineAt: new Date(`${addDays(todayKey, i + 1)}T00:00:00Z`),
    createTime: new Date(Date.now() - i * 3_600_000),
  }));
}

describe.skipIf(!hasDb)("/api/jobs 配额", () => {
  beforeEach(async () => {
    await resetDb();
    await seedDevUser();
    await insertJobs(manyJobs(25, dateKey(), addDays));
  });

  it("游客只看到截止最近的前 20 条，且筛选在这 20 条内", async () => {
    const guest = guestClient();
    const all = await (await guest("/api/jobs?pageSize=100")).json();
    expect(all.access).toEqual({ tier: "GUEST", visible: 20, total: 25 });
    expect(all.total).toBe(20);
    expect(all.items.map((j: { id: number }) => j.id)).toEqual(Array.from({ length: 20 }, (_, i) => 100 + i));
    const beijing = await (await guest("/api/jobs?city=北京&pageSize=100")).json();
    expect(beijing.total).toBe(10); // 前 20 条里 id 偶数的 10 条
    const posted = await (await guest("/api/jobs?sort=posted&pageSize=100")).json();
    expect(posted.items[0].id).toBe(100); // 排序仍在可见集合内
  });

  it("登录（FREE）看到全部 25 条（< 100）", async () => {
    const body = await (await apiRequest("/api/jobs?pageSize=100")).json();
    expect(body.access).toEqual({ tier: "FREE", visible: 100, total: 25 });
    expect(body.total).toBe(25);
  });
});
```
（`Prisma` 类型从 `../generated/prisma/client` 导入；`apiRequest` 已在 db.ts。）

`src/routes/quiz.test.ts` 新增（复用文件里的 `post`）：
```ts
async function insertManyQuestions(n: number) {
  await prisma.questionCategory.create({ data: { id: "cat-x", name: "配额测试" } });
  await prisma.question.createMany({
    data: Array.from({ length: n }, (_, i) => ({
      id: `qq-${String(i + 1).padStart(3, "0")}`,
      categoryId: "cat-x",
      prompt: `第 ${i + 1} 题`,
      options: LETTERS.map((letter) => ({ letter, text: `选项 ${letter}` })),
      answer: "A",
      explanation: ["解析"],
      difficulty: "EASY",
      source: "测试",
    })),
  });
}

describe.skipIf(!hasDb)("/api/quiz 配额", () => {
  beforeEach(async () => {
    await resetDb();
    await seedDevUser();
    await insertManyQuestions(22);
  });

  it("游客答完 20 道后 exhausted=QUOTA，第 21 道 403", async () => {
    const guest = guestClient();
    for (let i = 1; i <= 20; i++) {
      const today = await (await guest("/api/quiz/today")).json();
      expect(today.question.id).toBe(`qq-${String(i).padStart(3, "0")}`);
      expect(today.exhausted).toBeNull();
      expect((await guest("/api/quiz/attempts", post({ questionId: today.question.id, picked: "A" }))).status).toBe(200);
    }
    const done = await (await guest("/api/quiz/today")).json();
    expect(done).toMatchObject({ question: null, exhausted: "QUOTA" });
    const forbidden = await guest("/api/quiz/attempts", post({ questionId: "qq-021", picked: "A" }));
    expect(forbidden.status).toBe(403);
    expect(await forbidden.json()).toMatchObject({ error: { code: "FORBIDDEN" } });
    const dash = await (await guest("/api/quiz/dashboard")).json();
    expect(dash.access).toEqual({ tier: "GUEST", visible: 20, total: 22 });
  });

  it("PRO 无限制；全部答完 exhausted=ALL", async () => {
    await prisma.user.updateMany({ where: { email: DEV_USER_EMAIL }, data: { plan: "PRO" } });
    for (let i = 1; i <= 22; i++) {
      await apiRequest("/api/quiz/attempts", post({ questionId: `qq-${String(i).padStart(3, "0")}`, picked: "A" }));
    }
    const done = await (await apiRequest("/api/quiz/today")).json();
    expect(done).toMatchObject({ question: null, exhausted: "ALL" });
    const dash = await (await apiRequest("/api/quiz/dashboard")).json();
    expect(dash.access).toEqual({ tier: "PRO", visible: null, total: 22 });
  });
});
```
（导入 `DEV_USER_EMAIL` 自 `../auth`、`apiRequest / guestClient` 自 `../test/db`。）现有 quiz 用例的 `today` 断言若用了 `toEqual` 整对象，改成 `toMatchObject`。

```bash
pnpm exec vitest run src/routes/jobs.test.ts src/routes/quiz.test.ts
```
Expected：新用例 FAIL（`access` undefined / 403 未实现）。

- [ ] **Step 3: `src/services/jobs.ts`**

```ts
import type { Access } from "../lib/access";

const DEFAULT_ORDER: Prisma.JobOrderByWithRelationInput[] = [
  { deadlineAt: { sort: "asc", nulls: "last" } },
  { createTime: "desc" },
];

/** 当前档位可见的岗位 id；null = 不限制 */
async function visibleJobIds(access: Access): Promise<number[] | null> {
  if (access.jobs === null) return null;
  const rows = await prisma.job.findMany({ select: { id: true }, orderBy: DEFAULT_ORDER, take: access.jobs });
  return rows.map((r) => r.id);
}

export async function listJobs(query: JobListQuery, userId: string, access: Access): Promise<JobListResult> {
  const visible = await visibleJobIds(access);
  const where: Prisma.JobWhereInput = {
    ...(visible && { id: { in: visible } }),
    ...(query.category && { categoryId: query.category }),
    ...(query.city && { workLocation: { contains: query.city } }),
    ...(query.q && { OR: [ /* 原样 */ ] }),
  };
  const orderBy = query.sort === "posted" ? [{ createTime: "desc" as const }] : DEFAULT_ORDER;

  const [rows, total, grandTotal] = await Promise.all([
    prisma.job.findMany({ where, orderBy, skip: (query.page - 1) * query.pageSize, take: query.pageSize, include: userState(userId) }),
    prisma.job.count({ where }),
    prisma.job.count(),
  ]);

  const today = dateKey();
  return {
    items: rows.map((r) => toJobListItem(r, today)),
    total,
    page: query.page,
    pageSize: query.pageSize,
    access: { tier: access.tier, visible: access.jobs, total: grandTotal },
  };
}
```

- [ ] **Step 4: `src/services/quiz.ts`**

```ts
import type { Access } from "../lib/access";
import { AppError, NotFoundError } from "../lib/errors";

/** 当前档位可见的题目 id（按 id 升序前 N）；null = 不限制 */
async function visibleQuestionIds(access: Access): Promise<string[] | null> {
  if (access.questions === null) return null;
  const rows = await prisma.question.findMany({ select: { id: true }, orderBy: { id: "asc" }, take: access.questions });
  return rows.map((r) => r.id);
}

export async function getTodayQuestion(userId: string, access: Access): Promise<QuizToday> {
  const today = dateKey();
  const visible = await visibleQuestionIds(access);
  const unattempted = { attempts: { none: { userId } } } as const;
  const [question, attemptedToday] = await Promise.all([
    prisma.question.findFirst({
      where: { ...unattempted, ...(visible && { id: { in: visible } }) },
      orderBy: { id: "asc" },
      include: { category: { select: { name: true } } },
    }),
    prisma.attempt.count({ where: { userId, answeredAt: { gte: keyToInstant(today), lt: keyToInstant(addDays(today, 1)) } } }),
  ]);
  let exhausted: QuizToday["exhausted"] = null;
  if (!question) {
    const anyLeft = await prisma.question.count({ where: unattempted });
    exhausted = anyLeft > 0 ? "QUOTA" : "ALL";
  }
  return { question: question ? { /* 原样 */ } : null, indexLabel: ..., attemptedToday, date: today, exhausted };
}

export async function submitAnswer(userId: string, questionId: string, picked: QuizOptionLetter, access: Access): Promise<QuizAnswerResult> {
  const visible = await visibleQuestionIds(access);
  if (visible && !visible.includes(questionId)) throw new AppError(403, "FORBIDDEN", "当前档位不可作答此题，登录或升级后继续");
  /* 其余原样 */
}

export async function getDashboard(userId: string, access: Access): Promise<QuizDashboard> {
  /* 原有 Promise.all 里再加一个 prisma.question.count() → questionTotal */
  return { ...原样, access: { tier: access.tier, visible: access.questions, total: questionTotal } };
}
```

- [ ] **Step 5: 路由传入 `c.var.access`**

`routes/jobs.ts`：`listJobs(c.req.valid("query"), c.var.userId, c.var.access)`。`routes/quiz.ts`：`getTodayQuestion(c.var.userId, c.var.access)`、`submitAnswer(c.var.userId, questionId, picked, c.var.access)`、`getDashboard(c.var.userId, c.var.access)`。

- [ ] **Step 6: 门禁**

```bash
pnpm openapi && pnpm typecheck && pnpm exec biome format --write . >/dev/null && pnpm lint && pnpm test
```
Expected：**78 pass**（74 + jobs 2 + quiz 2）；`openapi.json` 里 `Access` 组件、`JobListResult.access`、`QuizToday.exhausted`、`QuizDashboard.access`、attempts 的 403。

- [ ] **Step 7: 冒烟（PORT=3002，不碰 3001）**

```bash
(PORT=3002 pnpm dev > /tmp/back-3002.log 2>&1 &) ; sleep 4
curl -s -c /tmp/jar -b /tmp/jar "localhost:3002/api/me"; echo
curl -s -b /tmp/jar "localhost:3002/api/jobs?pageSize=1" | head -c 200; echo
pkill -f "PORT=3002" ; pkill -f "tsx watch src/index.ts" -n ; lsof -i :3002 | wc -l
```
Expected：第一行 `tier: "GUEST"`；第二行末尾有 `"access":{"tier":"GUEST","visible":20,"total":N}`。**杀进程时只杀 3002 的那个**（`lsof -t -i :3002 | xargs kill`），确认 3001 仍在。

- [ ] **Step 8: 提交并推送**

```bash
git add -A && git commit -m "feat(access): 岗位 / 题库按档位限制可见范围；JobListResult.access、QuizToday.exhausted、QuizDashboard.access；越权作答 403" && git push origin main
```

---

### Task 3（前端）: 类型重生成、导航栏、路由守卫、`AccessBanner`、`/pro`

**Files:**
- Modify: `src/api/schema.d.ts`（生成）、`src/api/types.ts`、`src/api/mutations.ts`、`src/routes/index.tsx`、`src/routes/practice.tsx`、`src/routes/login.tsx`、`src/widgets/navbar/Navbar.tsx`、`src/routeTree.gen.ts`（生成）
- Create: `src/widgets/access-banner/access-message.ts`、`src/widgets/access-banner/access-message.test.ts`、`src/widgets/access-banner/AccessBanner.tsx`、`src/routes/pro.tsx`、`src/views/pro/ProPage.tsx`

**Interfaces:**
- Consumes: 后端 `openapi.json`（Task 2 之后）。
- Produces: `AccessBanner`（props `{ access: Access; kind: "jobs" | "questions"; className? }`）、`accessMessage()`；路由 `/pro`。

- [ ] **Step 1: 重生成类型**

```bash
OPENAPI_SOURCE=/Users/black/Desktop/job_hunt_back/openapi.json pnpm gen:api
```
`src/api/types.ts` 加：
```ts
export type Tier = S["Tier"];
export type Plan = S["Plan"];
export type Access = S["Access"];
```
（`User` 已存在。）

- [ ] **Step 2: 失败测试 `src/widgets/access-banner/access-message.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { accessMessage } from "./access-message";

describe("accessMessage", () => {
  it("游客达到上限 → 提示登录", () => {
    const m = accessMessage({ tier: "GUEST", visible: 20, total: 137 }, "jobs");
    expect(m).toEqual({
      title: "未登录只能查看前 20 条岗位",
      body: "登录后可查看前 100 条，共 137 条。",
      action: { label: "登录", to: "/login" },
    });
  });
  it("免费用户达到上限 → 提示升级", () => {
    const m = accessMessage({ tier: "FREE", visible: 200, total: 350 }, "questions");
    expect(m).toEqual({
      title: "免费账号可练习前 200 道题",
      body: "升级 PRO 解锁全部 350 道。",
      action: { label: "了解 PRO", to: "/pro" },
    });
  });
  it("未达上限或 PRO → null", () => {
    expect(accessMessage({ tier: "GUEST", visible: 20, total: 12 }, "jobs")).toBeNull();
    expect(accessMessage({ tier: "PRO", visible: null, total: 999 }, "jobs")).toBeNull();
  });
});
```

- [ ] **Step 3: `access-message.ts` 与 `AccessBanner.tsx`**

```ts
// access-message.ts
import type { Access } from "@api/types";

/** 与后端 LIMITS.FREE 一致（双份维护：后端 src/lib/access.ts） */
export const FREE_LIMITS = { jobs: 100, questions: 200 } as const;

export type AccessKind = "jobs" | "questions";

export interface AccessMessage {
  title: string;
  body: string;
  action: { label: string; to: "/login" | "/pro" };
}

const NOUN: Record<AccessKind, { unit: string; thing: string; verb: string }> = {
  jobs: { unit: "条", thing: "岗位", verb: "查看" },
  questions: { unit: "道", thing: "题", verb: "练习" },
};

export function accessMessage(access: Access, kind: AccessKind): AccessMessage | null {
  if (access.visible === null || access.total <= access.visible) return null;
  const n = NOUN[kind];
  if (access.tier === "GUEST") {
    return {
      title: `未登录只能${n.verb}前 ${access.visible} ${n.unit}${n.thing}`,
      body: `登录后可${n.verb}前 ${FREE_LIMITS[kind]} ${n.unit}，共 ${access.total} ${n.unit}。`,
      action: { label: "登录", to: "/login" },
    };
  }
  if (access.tier === "FREE") {
    return {
      title: `免费账号可${n.verb}前 ${access.visible} ${n.unit}${n.thing}`,
      body: `升级 PRO 解锁全部 ${access.total} ${n.unit}。`,
      action: { label: "了解 PRO", to: "/pro" },
    };
  }
  return null;
}
```
（注意测试期望文案：jobs 用"查看…岗位"，questions 用"练习…题"——上面的模板正好生成 `未登录只能查看前 20 条岗位` / `免费账号可练习前 200 道题`。）

```tsx
// AccessBanner.tsx
import { Link } from "@tanstack/react-router";
import type { Access } from "@api/types";
import { Button } from "@shared/ui/Button";
import { cn } from "@shared/lib/cn";
import { type AccessKind, accessMessage } from "./access-message";

interface AccessBannerProps {
  access: Access;
  kind: AccessKind;
  className?: string;
}

export function AccessBanner({ access, kind, className }: AccessBannerProps) {
  const m = accessMessage(access, kind);
  if (!m) return null;
  return (
    <div className={cn("flex flex-col gap-3 border border-accent bg-accent-100 px-4 py-4 sm:flex-row sm:items-center sm:px-5", className)}>
      <div className="flex-1">
        <p className="font-heading text-lg">{m.title}</p>
        <p className="mt-1 text-sm text-neutral-700">{m.body}</p>
      </div>
      <Button variant="primary" size="lg" blueprint asChild>
        <Link to={m.action.to}>{m.action.label}</Link>
      </Button>
    </div>
  );
}
```
若 `Button` 不支持 `asChild`（看 `src/shared/ui/Button.tsx`），改为 `<Link to={m.action.to} className="...与 Button primary 相同的类名...">`，并在报告说明。

`pnpm exec vitest run src/widgets/access-banner` → 3 pass。

- [ ] **Step 4: 路由与导航栏**

`routes/index.tsx`、`routes/practice.tsx`：删除整个 `beforeLoad`（和 `redirect`、`ApiError` 的导入）；在 `loader` 的 `Promise.all` 里加 `queryClient.ensureQueryData(meQuery())`（导航栏要用）。
`routes/login.tsx` `beforeLoad` 改为：
```ts
  beforeLoad: async ({ context: { queryClient }, search }) => {
    const me = await queryClient.fetchQuery(meQuery());
    if (me.tier !== "GUEST") throw redirect({ to: "/" });
    return { redirectTo: search.redirect };
  },
```
（删除 `ApiError` 导入。）

`Navbar.tsx`：
- `handleLogout` 改为 `await logout.mutateAsync(); navigate({ to: "/", replace: true });`
- 右侧区域：
```tsx
      {user.tier === "GUEST" ? (
        <Link to="/login" className="text-sm text-accent-700 hover:text-accent-900">登录</Link>
      ) : (
        <details className="group relative"> …原账号菜单… </details>
      )}
```
账号菜单的信息块里加一行档位：
```tsx
            <p className="mt-1 text-[11px] text-accent-700">
              {user.tier === "PRO" ? `PRO${user.proExpiresAt ? ` · 至 ${user.proExpiresAt.slice(0, 10)}` : ""}` : "免费账号"}
            </p>
```
菜单里再加一项 `<Link to="/pro" className="...同退出按钮样式...">{user.tier === "PRO" ? "我的 PRO" : "升级 PRO"}</Link>`。

- [ ] **Step 5: `/pro` 页**

`routes/pro.tsx`：
```tsx
import { createFileRoute } from "@tanstack/react-router";
import { meQuery } from "@api/queries";
import { ErrorPanel } from "@shared/ui/ErrorPanel";
import { ProPage } from "@views/pro/ProPage";

export const Route = createFileRoute("/pro")({
  loader: ({ context: { queryClient } }) => queryClient.ensureQueryData(meQuery()),
  component: ProPage,
  errorComponent: ErrorPanel,
});
```
`views/pro/ProPage.tsx`：
```tsx
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { meQuery } from "@api/queries";
import { Button } from "@shared/ui/Button";
import { Kicker } from "@shared/ui/Kicker";
import { Tag } from "@shared/ui/Tag";
import { Navbar } from "@widgets/navbar/Navbar";

const ROWS = [
  { label: "岗位公告", guest: "前 20 条", free: "前 100 条", pro: "全部" },
  { label: "题库", guest: "前 20 道", free: "前 200 道", pro: "全部" },
  { label: "收藏 / 投递 / 错题本", guest: "✓", free: "✓", pro: "✓" },
];

export function ProPage() {
  const { data: user } = useSuspenseQuery(meQuery());
  return (
    <div className="flex min-h-full flex-col bg-bg">
      <Navbar active="jobs" />
      <section className="px-4 py-10 sm:px-8">
        <Kicker className="text-accent-700">PRO</Kicker>
        <h1 className="mt-2 text-[32px] sm:text-[44px]">解锁全部岗位与题库</h1>
        <p className="mt-3 max-w-[640px] text-[15px] text-neutral-700">
          当前档位：<Tag variant={user.tier === "PRO" ? "accent" : "neutral"}>{user.tier === "PRO" ? "PRO" : user.tier === "FREE" ? "免费账号" : "游客"}</Tag>
        </p>
        <div className="mt-8 max-w-[760px] overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead className="text-left text-xs text-neutral-700">
              <tr><th className="py-2">权益</th><th>游客</th><th>免费</th><th className="text-accent-700">PRO</th></tr>
            </thead>
            <tbody>
              {ROWS.map((r) => (
                <tr key={r.label} className="border-t border-divider">
                  <td className="py-3 font-medium">{r.label}</td><td>{r.guest}</td><td>{r.free}</td><td className="text-accent-800">{r.pro}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-8 max-w-[640px] border border-divider p-5">
          <p className="font-heading text-lg">如何开通</p>
          <p className="mt-2 text-sm leading-relaxed text-neutral-700">
            公司注册手续办理中，在线支付尚未开放。现阶段请添加微信 <b>（待填写）</b> 联系开通，我们会在核对后为你的手机号开启 PRO。
          </p>
          {user.tier === "GUEST" && (
            <Button variant="primary" size="lg" blueprint className="mt-4" asChild>
              <Link to="/login">先登录</Link>
            </Button>
          )}
        </div>
      </section>
    </div>
  );
}
```
（`asChild` 同上处理。）

- [ ] **Step 6: 门禁**

```bash
pnpm typecheck && pnpm exec biome format --write src >/dev/null && pnpm lint && pnpm test
```
Expected：8 tests pass（5 + 3）；`routeTree.gen.ts` 含 `/pro`。

- [ ] **Step 7: 提交**

```bash
git add -A && git commit -m "feat(web): 档位类型、游客可访问、导航栏登录/档位、AccessBanner、/pro 页"
```

---

### Task 4（前端）: 看板与刷题页接线、浏览器验收、PR

**Files:**
- Modify: `src/views/job-board/JobBoardPage.tsx`、`src/views/practice/PracticePage.tsx`、`README.md`（一行）

- [ ] **Step 1: 看板**

`JobBoardPage.tsx`：`import { AccessBanner } from "@widgets/access-banner/AccessBanner";`；在分页区 `</div>`（最外层容器闭合前）之前加：
```tsx
      {result.page >= totalPages && (
        <AccessBanner access={result.access} kind="jobs" className="mx-4 mb-10 sm:mx-8" />
      )}
```

- [ ] **Step 2: 刷题**

`PracticePage.tsx`：`import { AccessBanner } from "@widgets/access-banner/AccessBanner";`；`question ? … : (…)` 的 else 分支改为：
```tsx
        ) : today.exhausted === "QUOTA" ? (
          <div className="px-4 py-8 sm:px-8 sm:py-9">
            <Kicker className="text-accent-700">今日一题</Kicker>
            <AccessBanner access={dashboard.access} kind="questions" className="mt-4 max-w-[720px]" />
          </div>
        ) : (
          …现有"题库已全部答完"块…
        )}
```

- [ ] **Step 3: README**

"接口类型"段后加一句：`游客无需登录即可浏览前 20 条岗位 / 20 道题；登录与 PRO 的权益见 /pro。`

- [ ] **Step 4: 门禁 + 浏览器验收**

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
(pnpm dev > /tmp/web-dev.log 2>&1 &) ; sleep 5
```
后端用 :3001 上已在跑的（它是 tsx watch，已含 Task 1–2 代码；若 `curl localhost:3001/api/me` 不返回 `tier` 字段，改起 `PORT=3002` 并把 `.env.local` 的 `VITE_API_PROXY` 临时指向 3002，验收完改回）。开发库岗位只有 3 条 → 先导入更多：`cd /Users/black/Desktop/job_hunt_back && pnpm db:import /Users/black/Desktop/job_hunt_front/.superpowers/sdd/2026-09-12-backend-data-layer/jobs-fixture.xlsx` 仍只有 3 条；用 `prisma studio` 或一段 tsx 脚本往开发库插 30 条测试岗位（`enterpriseName: 测试公司N`，`deadlineAt` 递增）。

浏览器（新隐私窗口 = 无 cookie）：
1. 打开 `/`：不跳登录；导航栏右侧是"登录"；列表最多 20 条，翻到末页底部出现"未登录只能查看前 20 条岗位…登录"提示条。
2. 打开 `/practice`：能答题；侧栏正常。
3. 点"登录"→ 手机号流程 → 回到 `/`：导航栏账号菜单显示"免费账号"；提示条消失（30 条 < 100）；之前游客收藏的岗位仍是 ★。
4. 账号菜单 → "升级 PRO" → `/pro` 页显示当前档位"免费账号"。
5. 后端 `pnpm set-plan <手机号> PRO 30` → 刷新 `/pro` 显示 PRO · 至 日期。
6. 退出登录 → 回到 `/`，导航栏又是"登录"，提示条回到"前 20 条"。
截图放报告；结束 `pkill -f vite`，若起了 3002 也杀掉，`.env.local` 改回。

- [ ] **Step 5: 提交、推送**

```bash
git add -A && git commit -m "feat(web): 看板 / 刷题页按档位显示配额提示" && git push -u origin feat/access-tiers
```
PR 由控制者创建。
