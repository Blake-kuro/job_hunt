# 前后端分离重构（Monorepo）设计

日期：2026-09-13
状态：已与用户逐节确认
前置文档：`docs/superpowers/specs/2026-09-12-backend-data-layer-design.md`（下称"原 spec"）。本文件只写**变化**；数据模型、service 签名、REST 端点、导入/种子逻辑凡未提及者，一律沿用原 spec。

## 1. 背景与目标

现状：Next.js 16 单体，App Router 里 Server Component 直接调 service，`src/app/api` 提供 REST；原 spec 的 13 个任务做到 Task 9（数据层、jobs 接口、看板页接线、Excel 导入）已完成并合入 `main`，Task 10–13（刷题模块、README）**作废**，改在新架构里实现。

目标：拆成独立的前端 SPA 与后端 API，两者共享类型；刷题模块在新架构里一次做完。

不做：登录、SSR、部署配置、CORS（生产由部署层决定）、OpenAPI 文档、gRPC / tRPC。

## 2. 技术选型（已确认）

| 层 | 选择 | 版本（2026-09-13 npm latest） | 不选的 |
|---|---|---|---|
| 包管理 | pnpm workspace（`corepack enable pnpm`） | corepack 0.34 | npm workspaces |
| 语言 | TypeScript 7（Go 原生编译器，`tsgo --noEmit` 做类型检查） | 7.0.2 | — |
| 后端 | Hono + `@hono/node-server` + `@hono/zod-validator` | hono 4.13 | Fastify（TS 样板多、无 RPC 客户端） |
| ORM | Prisma 7 + `@prisma/adapter-pg`（不变） | 7.10 | — |
| 前端构建 | Vite 8 + `@vitejs/plugin-react` + `@tailwindcss/vite` | vite 8.3 | — |
| 路由 | TanStack Router（文件式，类型化 search params） | 1.170 | React Router 7（search params 需手写解析） |
| 数据 | TanStack Query | 5.102 | SWR |
| 端到端类型 | `packages/shared`（zod + DTO）+ Hono RPC `hc<AppType>` | — | tRPC、gRPC |
| Lint / format | Biome（全仓一份配置） | 2.5.13 | eslint（随 Next 删除） |
| 测试 | vitest（shared、api） | 5 | — |
| 运行时 | Node ≥ 22（`.nvmrc` = 22） | — | — |

## 3. 仓库结构

```
job_hunt_front/
├── pnpm-workspace.yaml          packages: apps/*, packages/*
├── package.json                 私有根包：workspace 脚本 + biome + typescript
├── tsconfig.base.json           strict, target ES2022, module ESNext, moduleResolution bundler, isolatedModules, skipLibCheck
├── biome.json                   全仓 lint + format（2 空格、双引号、行宽 120，与现有代码风格一致）
├── .nvmrc                       22
├── docker-compose.yml           不动（Postgres 16，宿主端口 5433）
├── .env.example / .env          不动（DATABASE_URL）；api 与 prisma.config.ts 通过 dotenv 读根目录 .env
├── docs/                        不动
│
├── packages/shared/             包名 @job-hunt/shared
│   ├── package.json             "exports": { ".": "./src/index.ts" }（源码直出，消费者自行转译）
│   └── src/
│       ├── index.ts
│       ├── http.ts              ApiErrorBody 类型
│       ├── job/{category,query,types}.ts
│       ├── job/query.test.ts
│       └── quiz/{schema,types}.ts
│
├── apps/api/                    包名 @job-hunt/api
│   ├── package.json
│   ├── prisma.config.ts         datasource url、migrations、seed: "tsx prisma/seed.ts"
│   ├── prisma/                  schema.prisma、migrations/、seed.ts（git mv）
│   ├── scripts/import-jobs.ts   （git mv）
│   ├── vitest.config.ts
│   └── src/
│       ├── index.ts             serve({ fetch: app.fetch, port })
│       ├── app.ts               Hono 实例、中间件、路由挂载、错误处理；export type AppType
│       ├── db.ts                （git mv，import 路径改为 ./generated/prisma/client）
│       ├── auth.ts              getCurrentUserId（去掉 server-only 与 React cache）
│       ├── generated/           prisma generate 输出，git-ignored
│       ├── lib/{dates,parse,job-row,errors}.ts + *.test.ts
│       ├── services/{users,jobs,quiz}.ts
│       ├── routes/{me,jobs,quiz}.ts + *.test.ts
│       └── test/{setup,db}.ts   集成测试用：truncate + fixture 插入
│
└── apps/web/                    包名 @job-hunt/web
    ├── package.json
    ├── index.html
    ├── vite.config.ts           react()、tailwindcss()、TanStackRouterVite()；server.proxy["/api"] → http://localhost:3001
    ├── tsconfig.json            paths: @shared/* @entities/* @features/* @widgets/* @views/*（与 vite resolve.alias 同步）
    └── src/
        ├── main.tsx             QueryClient + RouterProvider
        ├── router.tsx           createRouter({ routeTree, context: { queryClient } })
        ├── routeTree.gen.ts     插件生成，提交到 git
        ├── routes/{__root,index,practice}.tsx
        ├── api/{client,queries,mutations}.ts
        ├── styles/globals.css   @import "tailwindcss"; @import "./tokens.css"
        ├── shared/ entities/ features/ widgets/ views/   现有 FSD 目录 git mv 平移
```

### 3.1 类型共享的两条线

1. **DTO 与 zod schema** 放 `@job-hunt/shared`，api 和 web 都 `import { jobListQuerySchema, type JobListItem } from "@job-hunt/shared"`。
2. **路由签名** 走 Hono RPC：web 只做 `import type { AppType } from "@job-hunt/api"`。纯类型导入在 Vite 中被擦除，后端代码不会进入前端 bundle；web 的 `package.json` 把 `@job-hunt/api` 放在 `devDependencies`（`workspace:*`）以示只用类型。

现有 `src/entities/job/model/*` 拆分：`category.ts`、`query.ts`（去掉 `parseJobListQuery`——Router 的 `validateSearch` 直接用 schema）、`types.ts` 的接口部分 → shared；`isExpired / statusLabel / statusVariant` 留在 `apps/web/src/entities/job/model/ui.ts`。

### 3.2 Prisma

- `apps/api/prisma.config.ts`：`migrations.path = "prisma/migrations"`，`datasource.url = env("DATABASE_URL")`，`migrations.seed = "tsx prisma/seed.ts"`。dotenv 从 `../../.env` 加载（`import { config } from "dotenv"; config({ path: "../../.env" })`），保证在 `apps/api` 目录下执行 prisma 命令也能读到根 `.env`。
- `schema.prisma` 的 generator `output = "../src/generated/prisma"`（相对 schema 文件，即 `apps/api/src/generated/prisma`）。
- `apps/api/package.json` 的 `postinstall: prisma generate`。
- 已有 migration `20260912142540_init` 原样保留；本次不需要新 migration。

## 4. 后端 `apps/api`

### 4.1 应用装配 `src/app.ts`

```ts
import { Hono } from "hono";
import { logger } from "hono/logger";

export type Env = { Variables: { userId: string } };

const app = new Hono<Env>()
  .basePath("/api")
  .use(logger())
  .use(requestUser)            // 每请求：c.set("userId", await getCurrentUserId())
  .route("/me", meRoutes)
  .route("/jobs", jobRoutes)
  .route("/quiz", quizRoutes)
  .notFound((c) => c.json({ error: { code: "NOT_FOUND", message: "接口不存在" } }, 404))
  .onError(errorHandler);

export default app;
export type AppType = typeof app;
```

**硬约束**：所有路由文件必须链式定义（`new Hono<Env>().get(...).put(...)`）并 `export const xxxRoutes = ...`；不能先 `const r = new Hono()` 再分开 `r.get(...)`——否则 `AppType` 推导不出端点，前端 RPC 失去类型。

`src/index.ts`：

```ts
import { serve } from "@hono/node-server";
import app from "./app";
const port = Number(process.env.PORT ?? 3001);
serve({ fetch: app.fetch, port }, (info) => console.log(`api listening on http://localhost:${info.port}`));
```

### 4.2 用户注入 `src/auth.ts`

```ts
export const DEV_USER_EMAIL = "dev@local";
export async function getCurrentUserId(): Promise<string>   // 查 users 表，缺失时抛 Error（同原实现，去掉 React cache）
export const requestUser: MiddlewareHandler<Env>            // c.set("userId", await getCurrentUserId()); await next()
```

以后接登录只改 `requestUser`。

### 4.3 校验与错误 `src/lib/errors.ts`

```ts
export class NotFoundError extends Error { name = "NotFoundError" }

export const validationHook: Hook          // zValidator 的第三参：失败时返回
  // c.json({ error: { code: "VALIDATION", message: "参数校验失败", issues: result.error.issues } }, 400)

export const errorHandler: ErrorHandler<Env>
  // NotFoundError → 404 { error: { code: "NOT_FOUND", message } }
  // 其他 → console.error + 500 { error: { code: "INTERNAL", message: "服务器内部错误" } }
```

原 `src/server/lib/http.ts`（`json/noContent/readJson/readQuery/handle`）整体删除。

### 4.4 路由

端点、请求、响应与原 spec 第 7 节完全一致（12 个）。写法示例（`routes/jobs.ts`）：

```ts
const idParam = z.object({ id: z.coerce.number().int().positive() });
const applicationBody = z.object({ status: z.enum(["APPLIED", "INTERVIEWING"]) });

export const jobRoutes = new Hono<Env>()
  .get("/", zValidator("query", jobListQuerySchema, validationHook), async (c) =>
    c.json(await listJobs(c.req.valid("query"), c.var.userId)))
  .put("/:id/favorite", zValidator("param", idParam, validationHook), async (c) =>
    c.json(await setFavorite(c.req.valid("param").id, c.var.userId, true)))
  .delete("/:id/favorite", zValidator("param", idParam, validationHook), async (c) =>
    c.json(await setFavorite(c.req.valid("param").id, c.var.userId, false)))
  .put("/:id/application", zValidator("param", idParam, validationHook), zValidator("json", applicationBody, validationHook), async (c) =>
    c.json(await setApplication(c.req.valid("param").id, c.var.userId, c.req.valid("json").status)))
  .delete("/:id/application", zValidator("param", idParam, validationHook), async (c) =>
    c.json(await setApplication(c.req.valid("param").id, c.var.userId, null)));
```

`routes/quiz.ts` 六个端点同理；`PUT /quiz/wrong-book/:questionId` 返回 `c.body(null, 204)`。`GET /api/jobs/progress` **新增**一个端点返回 `getProgress(userId)`（原来由 Server Component 直接调 service，现在前端需要它）。

### 4.5 服务层

- `services/jobs.ts`、`services/users.ts`：原样搬，删 `server-only`。`getCurrentUser()` 改为接收 `userId` 参数（中间件已查过，避免二次查库）。
- `services/quiz.ts`：按原 spec 6.3 新写。`Question.options` 的 Json 读出后用 shared 的 `quizOptionsSchema` 解析后再返回。

### 4.6 集成测试（打真库）

- `vitest.config.ts`：`setupFiles: ["src/test/setup.ts"]`，`fileParallelism: false`（共享一个数据库，文件串行）。
- `src/test/db.ts`：`resetDb()` = `TRUNCATE "Attempt","WrongBookEntry","Question","CompanySet","QuestionCategory","Application","Favorite","Job","User" RESTART IDENTITY CASCADE`；`seedUser()`；`insertJobs(rows)`；`insertQuestions(rows)`。
- 每个 `routes/*.test.ts`：`beforeEach(resetDb + 最小 fixture)`，用 `app.request("/api/jobs?category=1")` / `app.request("/api/jobs/1/favorite", { method: "PUT" })` 断言状态码与 JSON。
- 覆盖：每个端点至少一个 200 用例；jobs 列表的筛选/排序/分页各一个；一个 400（非法 query / body）；一个 404（不存在的 id）；quiz 的 submitAnswer 答错→错题本出现、setMastered→消失。
- 纯函数测试（dates / parse / job-row，现有 37 个）原样搬，不需要数据库；shared 的 schema 测试也不需要。
- 需要数据库的测试在 `DATABASE_URL` 未设置时整文件 `describe.skip` 并打印提示，避免误跑。

## 5. 前端 `apps/web`

### 5.1 入口与路由

```ts
// main.tsx
const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } });
const router = createRouter({ routeTree, context: { queryClient }, defaultPreload: "intent" });
<QueryClientProvider client={queryClient}><RouterProvider router={router} /></QueryClientProvider>
```

```
routes/__root.tsx     createRootRouteWithContext<{ queryClient: QueryClient }>()；渲染 <Outlet/>；dev 下挂 TanStackRouterDevtools + ReactQueryDevtools
routes/index.tsx      validateSearch: jobListQuerySchema；loaderDeps: search；loader: ensureQueryData(jobsQuery(search)) + ensureQueryData(progressQuery())；component: JobBoardPage；errorComponent: ErrorPanel
routes/practice.tsx   loader: ensureQueryData(quizTodayQuery()) + ensureQueryData(quizDashboardQuery()) + ensureQueryData(companySetsQuery())；component: PracticePage
```

Navbar 现在各页自己渲染（`active` prop），保持不变，不上提到 root。

### 5.2 数据层 `src/api/`

```ts
// client.ts
import { hc } from "hono/client";
import type { AppType } from "@job-hunt/api";
export const api = hc<AppType>("/");
export class ApiError extends Error { constructor(public status: number, public body: ApiErrorBody) {...} }
export async function unwrap<T>(p: Promise<ClientResponse<T>>): Promise<T>   // !ok → throw new ApiError

// queries.ts —— queryOptions 工厂；queryKey 前缀：["jobs", query] ["jobs","progress"] ["quiz","today"] ["quiz","dashboard"] ["quiz","company-sets"]
export const jobsQuery = (q: JobListQuery) => queryOptions({ queryKey: ["jobs", q], queryFn: () => unwrap(api.api.jobs.$get({ query: q })) });
export const progressQuery, quizTodayQuery, quizDashboardQuery, companySetsQuery

// mutations.ts —— useMutation 封装
useToggleFavorite(search)   onMutate: cancelQueries(["jobs", search]) + setQueryData 翻转 starred；onError 回滚；onSettled invalidate ["jobs"]
useMarkApplied(search)      同上，applicationStatus = "APPLIED"
useSubmitAttempt()          onSuccess: invalidate ["quiz"]
useSetMastered()            onMutate: 从 dashboard.wrongList 里乐观移除/加回；onError 回滚；onSettled invalidate ["quiz","dashboard"]
```

RPC 的 query 参数只接受字符串，`jobsQuery` 内部把 `JobListQuery` 的数字字段 `String()` 后传给 `$get`，并**省略 undefined 字段**。

### 5.3 页面

**`views/job-board/JobBoardPage.tsx`**
- `const search = Route.useSearch()`；`const { data: result } = useSuspenseQuery(jobsQuery(search))`；`const { data: progress } = useSuspenseQuery(progressQuery())`。
- 删除：`useState(result.items)`、`prevResult` 渲染期同步、`patchItem`、手写 `fetch`。
- `navigate = useNavigate({ from: "/" })`；所有筛选/翻页调用 `navigate({ search: (prev) => ({ ...prev, ...patch, page: 1 }) })`（翻页不重置 page）；`replace: true`。
- `buildHref` 删除（Router 序列化 search）。默认值（`sort=deadline`、`page=1`、`pageSize`）不出现在 URL：`jobListQuerySchema` 用 `.default()`，Router 的 `search` 中间件 `stripSearchParams(defaults)` 去掉等于默认值的项。
- 导出 CSV、进度卡片、分页 UI 不变。

**`features/job-filters/JobFilters.tsx`**
- 删除 `prevQuery` 渲染期同步；组件外层 `key={search.q}` 由页面传入，使 URL 变化时 draft 重挂载。300ms 防抖 effect 保留。

**`views/practice/PracticePage.tsx`**（替代原 Task 12）
- `useSuspenseQuery` 读 today / dashboard / companySets。
- `QuizQuestion` 改为受控：props `question`（不含答案）、`onSubmit(picked)`、`result`（提交后的 `{ correct, answer, explanation, accuracyRate } | null`）。提交走 `useSubmitAttempt`；成功后显示解析与"下一题"（invalidate today 即换题）。题库答完显示"今日题库已答完"。
- `PracticeSidebar` 改为接收 `dashboard` prop（streak、week、weekSolved/weekTarget、totalSolved、categories、wrongList）+ `onToggleMastered`。
- `CompanySets` 接收 `items` prop。
- `entities/quiz/model/data.ts`（mock）删除；`entities/quiz/model/types.ts` 中与 DTO 重复的类型改为从 shared 重导出。

### 5.4 样式

`@tailwindcss/vite` 插件；`src/styles/globals.css` = `@import "tailwindcss"; @import "./tokens.css";`（`tokens.css` 从 `shared/styles` 挪到这里，`@theme` 内容不变）。`index.html` 引入 `/src/main.tsx`；字体链接从原 `layout.tsx` 挪到 `index.html`。

## 6. 刷题模块（数据、service、种子）

按原 spec 4.3（模型，migration 已存在）、6.3（service 签名）、9.2（`seedQuiz()`）实现，落在 `apps/api`。种子内容来自现有 `src/entities/quiz/model/data.ts` 的 mock：1 道今日题扩展为至少 20 道（覆盖 `categories` 里的每个分类，`companySets` 每个题集至少 3 道），确保看板"试题 N / 20"与题集 count 有意义。种子幂等：按 `QuestionCategory.name` / `CompanySet.company` upsert，题目按固定 `id`（`q-001` …）upsert。

## 7. 命令

根 `package.json`：

```
dev        pnpm -r --parallel --filter ./apps/* dev        （api :3001，web :5173）
build      pnpm -r --filter @job-hunt/shared --filter @job-hunt/api --filter @job-hunt/web build
test       pnpm -r test
typecheck  pnpm -r typecheck            （每包：tsgo --noEmit）
lint       biome check .
format     biome format --write .
db:up      docker compose up -d
db:migrate pnpm --filter @job-hunt/api exec prisma migrate dev
db:seed    pnpm --filter @job-hunt/api exec prisma db seed
db:import  pnpm --filter @job-hunt/api import       （api 包脚本 import = tsx scripts/import-jobs.ts）
```

`apps/api`：`dev = tsx watch src/index.ts`，`build = tsgo`（输出到 dist，`start = node dist/index.js`），`test = vitest run`。
`apps/web`：`dev = vite`，`build = tsgo --noEmit && vite build`，`preview = vite preview`。
`packages/shared`：`test = vitest run`，`typecheck = tsgo --noEmit`。

## 8. 迁移顺序（分支 `feat/monorepo-split`）

1. 骨架：`corepack enable pnpm`、`pnpm-workspace.yaml`、根 `package.json`/`tsconfig.base.json`/`biome.json`、三个包的空 `package.json` + `tsconfig.json`；`pnpm install` 成功。
2. `packages/shared`：抽出 job schema/类型，新写 quiz schema/类型，schema 测试。
3. `apps/api` 数据层：`git mv` prisma、db、auth、lib、services、scripts；`postinstall` 生成；现有 37 个纯函数测试在新位置通过；`db:migrate status` 无待迁移。
4. `apps/api` HTTP：`app.ts`、`index.ts`、`lib/errors.ts`、`routes/{me,jobs}`、测试基础设施、jobs/me 集成测试。
5. `apps/api` quiz：`services/quiz.ts`、`routes/quiz.ts`、`seedQuiz`、集成测试。
6. `apps/web` 骨架：Vite/Tailwind/Router/Query/RPC client、`__root`、`git mv` FSD 目录、别名；空页面可打开。
7. `apps/web` 看板页：`routes/index.tsx`、JobBoardPage / JobFilters 重写。
8. `apps/web` 刷题页：`routes/practice.tsx`、PracticePage 及三个子组件接线、删 mock。
9. 清理：删 `src/`（剩余 Next 部分）、`next.config.*`、`next-env.d.ts`、`.next`、`eslint.config.*`、`postcss.config.*`、旧 `tsconfig.json`/`vitest.config.ts`/`prisma.config.ts`；根依赖里删 `next`、`eslint*`、`server-only`、`@tailwindcss/postcss`、`react*`（挪到 web）；`AGENTS.md` 去掉 Next 段落；README 重写；`.gitignore` 增加 `apps/api/src/generated`、`apps/web/dist`、`apps/api/dist`。

每步一个或多个提交；每步结束 `pnpm typecheck && pnpm lint && pnpm test` 对已存在的包必须全绿。

## 9. 验收

- `pnpm install && pnpm typecheck && pnpm lint && pnpm test` 全绿（api 测试需 `pnpm db:up`）。
- `pnpm dev` 后：
  - `http://localhost:5173/`：筛选分类/城市/搜索/排序/翻页均反映在 URL，刷新后保持；收藏与标记投递即时生效，刷新后保留；进度卡片在收藏/投递后自动更新；`/api/jobs?category=abc` 直接访问返回 400 JSON。
  - `http://localhost:5173/practice`：显示今日题，选项提交后出现解析与正确率，"下一题"换题；侧栏打卡格子与连续天数随作答变化；错题本可标记掌握并消失；公司题集列表带题数。
- `pnpm db:import -- <真实.xlsx>` 后看板显示真实数据，二次导入 created=0。
- `git grep -l "from \"next" -- apps packages` 为空；根目录无 `src/`、`.next/`。
- `apps/web` 生产构建（`pnpm --filter @job-hunt/web build`）产物中不含 `@prisma`、`hono` 的运行时代码（`grep -r "PrismaClient" apps/web/dist` 为空）。

## 10. 风险与应对

- **TS 7 与 typescript-eslint/biome 兼容**：只用 Biome，不引 typescript-eslint；若 `tsgo` 对某个包报不支持的选项（如 `plugins`），删掉该选项。
- **Hono RPC 的类型推导在大路由树上变慢**：三个路由文件、13 个端点，远未到阈值；若出现，按 Hono 文档把 `AppType` 拆成按路由文件的类型。
- **`stripSearchParams` 与 `.default()` 配合**：Router 的 `validateSearch` 输入是原始字符串对象，`jobListQuerySchema` 已用 `z.coerce`，可直接复用；若默认值剥离行为与预期不符，退化为手写 `search` 序列化（等价于现在的 `buildHref`）。
- **集成测试串行**：`fileParallelism: false` 使 api 测试总时长增加，当前规模（十几个文件）可接受。
