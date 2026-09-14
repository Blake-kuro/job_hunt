# 后台管理系统 job_hunt_admin 设计

日期：2026-09-14
状态：用户授权"决策都交给你"，本文为自主决策记录
涉及仓库：后端 `job_hunt_back`（main 基线 7cb69de，分支 `feat/admin-api`）、新仓库 `job_hunt_admin`（`Blake-kuro/job_hunt_admin`，私有，本地 `/Users/black/Desktop/job_hunt_admin`）
前置：另一会话（ChatGPT）已交付管理员角色、资料 / 课程、按内容授权、题目创建 / 修改（`src/routes/admin.ts`、`src/contract/admin.ts`），并已修复 5 项重要问题（7cb69de）。

## 1. 目标与决策

管理员（`User.role = ADMIN`，手机号在 `ADMIN_PHONE_NUMBERS` 里自动提升）需要一个独立的 Web 后台管理：学生账号、岗位、题库、资料、课程。

自主决策：

| 决策 | 选择 | 理由 |
|---|---|---|
| 管理端放哪 | **独立仓库 `job_hunt_admin`**，与 `job_hunt_front` 同栈（React 19 + Vite 8 + TanStack Router / Query + Tailwind v4 + openapi-fetch），同样从后端 `openapi.json` 生成类型 | 用户命名了 `job_hunt_admin`；后端将被其他项目复用，管理端与学生端解耦；学生端 bundle 不带后台代码 |
| 登录 | 复用现有手机号验证码登录（`/api/auth/sms/*`），登录后 `/api/me.role !== "ADMIN"` 视为无权限 | 不新增认证体系；后端已按 `ADMIN_PHONE_NUMBERS` 提升 |
| ChatGPT 的 `GET /api/admin/dashboard` | **删除**，拆成 `summary` + 各资源的分页列表 | 一次返回全部学生 / 题目 / 资料，数据一多就不可用；没有任何前端消费它 |
| 岗位管理 | **新增**（列表 / 新增 / 编辑 / 删除 / Excel 导入） | 岗位是产品核心，目前只能在服务器上跑 CLI 导入 |
| 题库分类 | 新增 `POST /api/admin/question-categories` | 建题需要分类 id；不做改名 / 删除（YAGNI） |
| 删除确认 | `window.confirm` | 后台工具，够用 |
| 管理端仓库分支 | 新仓库直接推 `main`；后端走分支 `feat/admin-api` + PR | 新仓库没有需要保护的 main |

不做：管理员互相管理（角色只由环境变量提升）、操作日志、文件上传（资料 / 课程封面 / 视频只存 URL）、题库批量导入、学生详情页。

## 2. 后端契约（`src/contract/admin.ts` 重写）

所有路由在 `/api/admin` 下，前置 `requestUser` + `assertAdmin`（改为读 `c.var.role`，不再重复查库；`requestUser` 已保证 `enabled`）。非管理员 → `403 FORBIDDEN "没有后台管理权限"`。

通用：

```ts
const PageQuery = { page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(20) };
const paged = <T>(item: T, name: string) => z.object({ items: z.array(item), total: z.number().int(), page: z.number().int(), pageSize: z.number().int() }).openapi(name);
const IsoDate = z.string().datetime();   // 响应用
const DateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);  // YYYY-MM-DD
```

### 2.1 概览

`GET /summary` → `AdminSummary`：
```ts
{ students, enabledStudents, proStudents, guests, jobs, questions, publishedQuestions, materials, courses }  // 全部 int
```
`students` = 有 PHONE 身份的用户数（含管理员）；`proStudents` = 其中 `plan=PRO` 且未过期；`guests` = 只有 DEVICE 身份的用户数。

### 2.2 学生

`GET /students?q&plan&enabled&page&pageSize` → `AdminStudentList`（分页）。`q` 匹配 `name contains` 或 `PHONE providerKey contains`；`plan` ∈ FREE|PRO；`enabled` 为 `"true"|"false"`（`z.enum(["true","false"]).transform`）。范围 = 有 PHONE 身份的用户，按 `createdAt desc, id asc`。

```ts
AdminGrant = { id, contentType: ContentType, contentId, contentTitle: string | null, expiresAt: string | null }
AdminStudent = { id, name, phone: string | null, role: "STUDENT"|"ADMIN", enabled, plan, proExpiresAt: string|null, tier: Tier, createdAt,
                 stats: { favorites: int, applications: int, attempts: int }, grants: AdminGrant[] }
```
`contentTitle`：MATERIAL → `StudyMaterial.title`，COURSE → `Course.title`，QUESTION → `Question.prompt` 前 40 字；找不到 → `null`。`tier` 用 `resolveTier`。

`PATCH /students/{id}` body `AdminStudentPatch = { name?: string.min(1), enabled?, plan?, proExpiresAt?: datetime | null }` → 204；目标是 ADMIN → 403；不存在 → 404。（保留 ChatGPT 实现，加 `name`。）

`PUT /students/{id}/access` body `AdminAccessBody = { grants: [{ contentType, contentId, expiresAt?: datetime|null }] }` → 204。新增校验：每条 `contentId` 必须存在于对应表，否则 `400 VALIDATION "内容不存在：<type>:<id>"`；目标用户不存在 → 404。

### 2.3 资料与课程

`GET /materials` → `AdminMaterial[]`（`orderBy updatedAt desc`）；`GET /courses` → `AdminCourse[]`（含 `lessons`，`sortOrder asc`）。

```ts
AdminMaterial = { id, title, description: string|null, category, resourceUrl, published, updatedAt }
AdminCourseLesson = { id, title, videoUrl, durationMinutes: int|null, sortOrder }
AdminCourse = { id, title, description: string|null, coverUrl: string|null, published, updatedAt, lessons: AdminCourseLesson[] }
```
`POST /content`（`AdminContentBody` 判别联合，保留）→ 改为 **201 `{ id }`**（新建返回新 id，更新返回原 id）。`DELETE /content/{type}/{id}` → 204（保留，连带删除授权）。

### 2.4 题库

`GET /quiz-meta` → `AdminQuizMeta = { categories: [{ id, name, questionCount: int }], companySets: [{ id, company, track, focus }] }`。

`GET /questions?q&categoryId&published&page&pageSize` → `AdminQuestionList`（分页，`orderBy id asc`）。`q` 匹配 `prompt contains`；`published` 同上 `"true"|"false"`。

```ts
AdminQuestion = { id, prompt, categoryId, categoryName, companySetId: string|null, options: QuizOption[] (4), answer: QuizOptionLetter,
                  explanation: string[], difficulty: "EASY"|"MEDIUM"|"HARD", source, published }
```
`options` 用 `quizOptionsSchema.parse` 从 Json 列还原（数据坏了直接 500，seed 保证形状）。

`POST /questions`（`AdminQuestionBody`，保留）→ **201 `{ id }`**。`PATCH /questions/{id}`（partial）→ 204，`categoryId` / `companySetId` 存在性校验同 POST。`DELETE /questions/{id}` → 204（级联删作答、错题；同时删 `AccessGrant{QUESTION, id}`，事务）。

`POST /question-categories` body `{ name: string.min(1).max(30) }` → 201 `{ id, name }`；重名 → `400 VALIDATION "分类已存在"`。

### 2.5 岗位

`GET /jobs?q&category&page&pageSize` → `AdminJobList`（分页，`orderBy createTime desc, id desc`）。`q` 匹配 `enterpriseName | position contains`；`category` 用 `jobListQuerySchema.shape.category`。

```ts
AdminJob = { id: int, serialNumber: string|null, categoryId: CategoryId, recruitmentBatch, enterpriseNature, industry, workLocation,
             position: string, enterpriseName: string, graduationYear, degree, announcementLink, deliveryAddress, deadline,   // 未标注的都是 string|null
             deadlineAt: DateKey|null, createTime: IsoDate, updateTime: IsoDate,
             stats: { favorites: int, applications: int } }
AdminJobBody = { categoryId: CategoryIdSchema, position: min(1), enterpriseName: min(1),
                 serialNumber?, recruitmentBatch?, enterpriseNature?, industry?, workLocation?, graduationYear?, degree?,
                 announcementLink?, deliveryAddress?, deadline?: string|null,        // 全部 z.string().nullable().optional()
                 deadlineAt?: DateKey | null }
```
写入时 `deadlineAt` 用 `keyToDate`（`src/lib/dates.ts`）转成 `@db.Date`；读出用 `dbDateToKey`。

`POST /jobs` → 201 `{ id }`；`PATCH /jobs/{id}`（`AdminJobBody.partial()`）→ 204；`DELETE /jobs/{id}` → 204（级联收藏 / 投递）；`id` 参数用 `IdParamSchema`。

`POST /jobs/import`：`multipart/form-data`，字段 `file`（xlsx）→ 200 `AdminImportResult`：
```ts
{ sheets: [{ name, created: int, updated: int, skipped: string[] }], usedIdKey: boolean }
```
实现：把 `scripts/import-jobs.ts` 的解析 / upsert 逻辑抽到 `src/lib/import-jobs.ts`：`importWorkbook(buffer: ArrayBuffer | Buffer, todayKey = dateKey()): Promise<AdminImportResult>`；`usedIdKey` 为真时在函数内执行 `SELECT setval(pg_get_serial_sequence('"Job"','id'), (SELECT COALESCE(MAX(id),1) FROM "Job"))`（CLI 也不再要求手动执行）。CLI 脚本变薄：读文件 → `importWorkbook` → 打印。非 xlsx / 解析失败 → `400 VALIDATION "无法解析 Excel 文件"`。请求体上限 20 MB（`bodyLimit`，hono 内置中间件）。

### 2.6 契约 / 文档

- 删除 `AdminDashboardSchema`、`getAdminDashboard`。
- `openapi.json` 重新生成并提交；`admin.test.ts` 重写覆盖 §2.1–2.5；README「后台管理」一节列出端点与 `ADMIN_PHONE_NUMBERS`。
- 顺手：`src/routes/content.ts` 若也重复查 role/enabled，改读 `c.var`。

## 3. 管理端 `job_hunt_admin`

### 3.1 脚手架

从 `job_hunt_front` 复制：`package.json`（`name: job-hunt-admin`，dev 端口 **5174**，preview **4174**，脚本同）、`vite.config.ts`（同别名、同 `/api` 代理）、`tsconfig.json`、`biome.json`、`index.html`（标题「职寻 · 管理后台」）、`src/styles/{tokens,globals}.css`、`src/shared/lib/cn.ts`、`src/shared/ui/{Button,Input,Tag,Kicker,ErrorPanel}.tsx`、`src/api/client.ts`（`CODES` 加 `FORBIDDEN`）、`src/api/client.test.ts`、`src/main.tsx`、`src/router.tsx`、`.env.example`（`VITE_API_PROXY=http://localhost:3001`）、`.gitignore`、`pnpm-workspace.yaml`（allowBuilds）。`src/api/schema.d.ts` 由后端 `feat/admin-api` 分支的 `openapi.json` 生成。`AGENTS.md` / `CLAUDE.md` 与 front 同样约定（端口换成 5174）。

新增通用 UI：
- `shared/ui/Dialog.tsx`：`<dialog>` + `showModal()`，props `{ open, title, onClose, children, footer? }`，Esc / 遮罩关闭。
- `shared/ui/Field.tsx`：`{ label, htmlFor, hint?, error?, children }` 标签壳。
- `shared/ui/Select.tsx`、`shared/ui/Textarea.tsx`：与 `Input` 同风格。
- `shared/ui/Pagination.tsx`：`{ page, pageSize, total, onChange }`，「上一页 / 第 x / y 页 / 下一页」。
- `shared/ui/StatCard.tsx`：`{ label, value, hint? }`。

### 3.2 路由与鉴权

```
routes/__root.tsx        RootLayout（Outlet + devtools）
routes/login.tsx         登录页；beforeLoad：me.role === "ADMIN" → redirect "/"
routes/_admin.tsx        受保护布局：beforeLoad fetch meQuery；role !== "ADMIN" → redirect "/login"（search.reason = tier==="GUEST" ? undefined : "forbidden"）
routes/_admin/index.tsx      概览
routes/_admin/students.tsx   validateSearch { q?, plan?, enabled?, page }
routes/_admin/jobs.tsx       validateSearch { q?, category?, page }
routes/_admin/questions.tsx  validateSearch { q?, categoryId?, published?, page }
routes/_admin/materials.tsx
routes/_admin/courses.tsx
```
`_admin` 布局：左侧固定侧栏（品牌「职寻 · 管理后台」、6 个 `Link`，`activeProps` 高亮；底部当前管理员 `name / phone` + 「退出」），右侧 `<main>` 滚动区。登录页复用 front 的 `LoginPage` 结构（去掉左侧宣传栏文案改为「管理后台」），`reason === "forbidden"` 时显示「该账号没有管理权限」并提供「退出当前账号」按钮（调 logout）。登录成功后 `router.invalidate()` + `navigate({ to: "/" })`（`_admin.beforeLoad` 会再次判定，非管理员会被带回登录页并显示 forbidden）。

### 3.3 数据层

`api/queries.ts`：`meQuery`, `summaryQuery`, `studentsQuery(search)`, `materialsQuery`, `coursesQuery`, `quizMetaQuery`, `questionsQuery(search)`, `jobsQuery(search)`（`queryOptions`，key 形如 `["admin","students",search]`）。
`api/mutations.ts`：`useSendLoginSms`, `useVerifyLoginSms`, `useLogout`, `usePatchStudent`, `usePutStudentAccess`, `useSaveContent`, `useDeleteContent`, `useCreateQuestion`, `usePatchQuestion`, `useDeleteQuestion`, `useCreateCategory`, `useCreateJob`, `usePatchJob`, `useDeleteJob`, `useImportJobs`。每个成功后 `invalidateQueries({ queryKey: ["admin", <资源>] })`（写操作影响 `summary` 的也失效 `["admin","summary"]`）。导入用 `client.POST("/api/admin/jobs/import", { body: { file }, bodySerializer: (b) => { const fd = new FormData(); fd.append("file", b.file); return fd; } })`。

纯函数（可测）：
- `views/questions/question-form.ts`：`QuestionFormState`（全部字符串 / 布尔字段）+ `toQuestionBody(state): { ok: true, body } | { ok: false, error }`（校验题干、4 个选项非空、来源非空、分类已选；`explanation` 按行拆分去空行）+ `fromQuestion(q): QuestionFormState`。
- `views/jobs/job-form.ts`：`toJobBody(state)`（空串 → `null`；`deadlineAt` 必须 `YYYY-MM-DD` 或空；企业 / 岗位非空）+ `fromJob(j)`。
- `views/students/grant-rows.ts`：`toAccessBody(rows)`（去掉空 contentId 行，`expiresAt` 日期转 `T00:00:00.000Z`）。

### 3.4 页面

- **概览**：9 个 `StatCard`（§2.1 全部字段）+ 每张卡链接到对应页。
- **学生**：顶部搜索框（300 ms 防抖写入 `q`，改动时 `page` 重置为 1）、档位 / 状态下拉；表格列：姓名·手机、角色、档位（Tag：游客 / 免费 / PRO·到期日）、状态、收藏 / 投递 / 作答、注册时间、操作。操作：「停用 / 启用」（直接 PATCH）、「档位」（Dialog：FREE / PRO 单选 + PRO 到期日期 `<input type=date>`，留空 = 永久）、「授权」（Dialog：行编辑器 [类型 select][内容：MATERIAL/COURSE 为标题下拉，QUESTION 为题目 id 输入并显示当前 `contentTitle`][到期日期][删除]，「添加一行」，保存 → PUT）。ADMIN 行的操作按钮禁用。
- **岗位**：搜索 + 分类 `Segmented`（全部 / 三类）+ 分页；表头右侧「导入 Excel」（隐藏 file input，选择即上传，完成后 Dialog 显示每个 sheet 的新增 / 更新 / 跳过明细）与「新增岗位」。表格列：企业、岗位、分类、城市、批次、截止（`deadline` 文本 + `deadlineAt`）、收藏 / 投递、发布时间、操作（编辑 / 删除）。岗位 Dialog 表单：分类 select、企业、岗位、序号、批次、企业性质、行业、城市、届别、学历、公告链接、投递地址、截止说明、截止日期（date）。
- **题库**：搜索 + 分类 select + 发布状态 select + 分页；「新建分类」（Dialog 输入名称）、「新增题目」。表格列：题干（截断 60 字）、分类、难度、来源、状态、操作（编辑 / 发布↔下架 / 删除）。题目 Dialog：题干 textarea、分类 select、公司题集 select（可空）、A–D 四个输入、正确答案 radio、解析 textarea（每行一条）、难度 select、来源、已发布 checkbox。
- **资料**：列表（标题、分类、链接、状态、更新时间、编辑 / 删除）+「新增资料」Dialog（标题、描述、分类、链接、已发布）。
- **课程**：列表（标题、课时数、状态、更新时间、编辑 / 删除）+「新增课程」Dialog（标题、描述、封面 URL、已发布、课时编辑器：行 [标题][视频 URL][时长分钟]，添加 / 删除 / 上移 / 下移）。

错误展示：mutation 失败在 Dialog 内 `role="alert"` 显示 `error.message`；列表加载失败用 `ErrorPanel`。

### 3.5 测试

- 后端：`admin.test.ts` 重写（summary 计数；学生列表搜索 / 过滤 / PATCH / 授权含 contentTitle 与不存在内容 400；资料 / 课程增删改；题库 meta / 分页 / 增删改 / 分类重名 400；岗位增删改 / 列表 / 导入（用 ExcelJS 在内存生成 1 个 sheet 2 行的 xlsx 上传，断言 created=2 且 `/api/admin/jobs` 能看到）；非管理员 403）。`lib/import-jobs.test.ts` 不单独写（通过路由测试覆盖）。
- 管理端：`api/client.test.ts`（复制）、`question-form.test.ts`、`job-form.test.ts`、`grant-rows.test.ts`。
- 浏览器验收：后端跑在 3001（`job_hunt_test` 或开发库），管理端 5174：管理员登录 → 概览 → 各页新增 / 编辑 / 删除一轮 → 非管理员手机号登录看到无权限提示。

## 4. 验收

- 后端 `pnpm typecheck && pnpm lint && pnpm test` 全绿，`openapi.json` 与代码一致；`pnpm db:import <xlsx>` 仍可用且不再要求手动 setval。
- 管理端 `pnpm typecheck && pnpm lint && pnpm test && pnpm build` 全绿；`schema.d.ts` 与后端分支 `openapi.json` 同步。
- 学生端 `job_hunt_front` 不受影响（其 `schema.d.ts` 在后端 PR 合并后再重新生成，本次不改）。
