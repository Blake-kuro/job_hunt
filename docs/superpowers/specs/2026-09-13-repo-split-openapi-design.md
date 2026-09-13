# 前后端拆为两个仓库 + OpenAPI 契约 设计

日期：2026-09-13
状态：已与用户逐节确认
前置：`2026-09-13-monorepo-split-design.md`（monorepo 版，已合并为 PR #1）。本文件只写变化。

## 1. 目标与不做

目标：后端独立成仓库 `Blake-kuro/job_hunt_back`（私有），供其他项目复用；前端留在 `job_hunt_front`。两者之间的契约是 **OpenAPI 3.1 文档**，不再共享 TypeScript 包。

不做：登录、部署配置、生产静态托管、E2E；不改任何业务语义（端点、字段、错误格式、service 行为全部不变）。

## 2. 技术选型

| 用途 | 选择 | 版本（2026-09-13） |
|---|---|---|
| 后端路由 + 文档 | `@hono/zod-openapi`（zod v4） | 1.6.3 |
| Swagger UI | `@hono/swagger-ui` | 0.6.1 |
| 前端类型生成 | `openapi-typescript`（通过 `pnpm dlx` 运行，自带 TS 5，不与前端 TS 7 冲突） | 7.13 |
| 前端 HTTP 客户端 | `openapi-fetch` | 0.17 |

不选：npm 发布类型包（需要发版、只服务 TS）；git 依赖（要拉整个后端源码并解析 Prisma 生成物）。

## 3. 后端仓库 `job_hunt_back`

### 3.1 结构

```
job_hunt_back/
├── package.json          name "job-hunt-back"，普通单包，pnpm；packageManager pnpm@12.4.1；engines node>=22
├── .nvmrc  biome.json  tsconfig.json  vitest.config.ts  prisma.config.ts  docker-compose.yml  .env.example  .gitignore
├── prisma/               schema、migrations、seed.ts、quiz-data.ts（原样）
├── scripts/import-jobs.ts（原样）
├── openapi.json          `pnpm openapi` 生成并提交；对外契约
└── src/
    ├── index.ts  app.ts  auth.ts  db.ts  env.ts  load-env.ts
    ├── contract/         原 packages/shared/src 合并进来（见 3.3）
    ├── routes/{me,jobs,quiz}.ts + *.test.ts   改为 createRoute（见 3.4）
    ├── lib/  services/  test/   原样（errors.ts 的 validationHook 改为 OpenAPIHono 的 defaultHook）
    └── generated/        git-ignored
```

`tsconfig.json` = 原 `tsconfig.base.json` 内容 + 原 `apps/api/tsconfig.json` 的 `lib/types/include/exclude`。`biome.json` 原样（去掉 workspace 相关的 `!**/routeTree.gen.ts` 不影响）。

### 3.2 历史迁移

```
# 在 job_hunt_front（main，已合并 PR #1）
git subtree split -P apps/api -b api-history
# 新仓库
gh repo create Blake-kuro/job_hunt_back --private
git clone <front repo> /Users/black/Desktop/job_hunt_back --branch api-history --single-branch
cd job_hunt_back && git remote set-url origin git@github.com:Blake-kuro/job_hunt_back.git && git branch -m main
```
随后以独立提交加入：根级配置文件（从 front 根复制）、`src/contract`（从 `packages/shared/src` 复制）、路由改写。`api-history` 分支用完删除。

### 3.3 `src/contract`：DTO 从 interface 改为 zod schema

所有对外响应体都要有 zod schema（OpenAPI 只认 schema）。命名规则：schema 用 `XxxSchema`，类型用 `type Xxx = z.infer<typeof XxxSchema>`；每个 schema 调 `.openapi("Xxx")` 注册成组件名，前端生成的类型就叫 `components["schemas"]["Xxx"]`。

```
contract/
├── index.ts
├── common.ts   ApiErrorSchema { error: { code: enum(VALIDATION|NOT_FOUND|INTERNAL), message, issues?: unknown[] } }
├── job.ts      CategoryIdSchema(1|2|3)、CATEGORY、jobListQuerySchema（原样）、ApplicationStatusSchema、
│               JobListItemSchema、JobListResultSchema、JobProgressSchema、IdParamSchema、ApplicationBodySchema、
│               FavoriteResultSchema { starred }、ApplicationResultSchema { applicationStatus }
├── quiz.ts     QuizOptionLetterSchema、QuizOptionSchema、quizOptionsSchema、SubmitAttemptSchema、SetMasteredSchema、
│               QuizQuestionPublicSchema、QuizTodaySchema、QuizAnswerResultSchema、WrongBookItemSchema、
│               QuizDashboardSchema、CompanySetItemSchema、QuestionIdParamSchema、
│               WrongBookListSchema { items }、CompanySetListSchema { items }
└── user.ts     UserSchema { id, email, name }
```

service 签名不变（`Promise<JobListResult>` 等），类型来源换成 `z.infer`。`z.infer` 与原 interface 结构必须一致；现有 service 与测试不改即通过是验收标准之一。

### 3.4 路由：`OPENAPIHono` + `createRoute`

```ts
// app.ts
const app = new OpenAPIHono<Env>({ defaultHook: validationHook })   // 校验失败 → 400 ApiError
  .basePath("/api")
  .use(cors({ origin: corsOrigins() }))                              // CORS_ORIGINS 逗号分隔，默认 http://localhost:5173
  .use(process.env.NODE_ENV === "test" ? passthrough : logger())
  .use(requestUser)
  .route("/me", meRoutes).route("/jobs", jobRoutes).route("/quiz", quizRoutes)
  .notFound(...).onError(errorHandler);

app.doc31("/openapi.json", { openapi: "3.1.0", info: { title: "job_hunt_back", version: "0.1.0" } });
app.get("/docs", swaggerUI({ url: "/api/openapi.json" }));
```

每个端点：

```ts
const listJobsRoute = createRoute({
  method: "get", path: "/", tags: ["jobs"], operationId: "listJobs",
  request: { query: jobListQuerySchema },
  responses: {
    200: { content: { "application/json": { schema: JobListResultSchema } }, description: "岗位列表" },
    400: { content: { "application/json": { schema: ApiErrorSchema } }, description: "参数错误" },
  },
});
export const jobRoutes = new OpenAPIHono<Env>({ defaultHook: validationHook })
  .openapi(listJobsRoute, async (c) => c.json(await listJobs(c.req.valid("query"), c.var.userId), 200))
  ...
```

规则：每个端点必须写 `operationId`（前端 hook 名与之对应）、`tags`、每个可能状态码的响应；404 用 `ApiErrorSchema`；204 写 `responses: { 204: { description } }` 且 handler `return c.body(null, 204)`。路径参数 schema 用 `z.object({ id: z.coerce.number().int().positive().openapi({ param: { name: "id", in: "path" } }) })`。

`validationHook` 签名改为 zod-openapi 的 defaultHook：`(result, c) => result.success ? undefined : c.json({ error: { code: "VALIDATION", message: "参数校验失败", issues: result.error.issues } }, 400)`。`NotFoundError` / `errorHandler` 不变。

### 3.5 `pnpm openapi` 与门禁

`scripts/openapi.ts`：`import app from "../src/app"; writeFileSync("openapi.json", JSON.stringify(app.getOpenAPI31Document({...}), null, 2))`（不连数据库）。
`package.json`：`"openapi": "tsx scripts/openapi.ts"`，`"openapi:check": "pnpm openapi && git diff --exit-code openapi.json"`。`pnpm test` 前先跑 `openapi:check`（作为 `pretest`），保证提交的契约和代码一致。

### 3.6 现有集成测试

`app.request(...)` 用法不变；因为 `OpenAPIHono` 校验失败走 `defaultHook`，400 断言不变。测试文件不需要改动是验收标准之一（若 zod-openapi 对 `param` 的 coerce 行为不同导致 404 用例变化，允许改测试并记录原因）。

### 3.7 环境变量

`.env.example`：`DATABASE_URL`、`TEST_DATABASE_URL`、`PORT=3001`、`CORS_ORIGINS=http://localhost:5173`。

## 4. 前端仓库 `job_hunt_front`

### 4.1 结构变化

`apps/web/*` 全部提升到根目录；删除 `apps/`、`packages/`、`pnpm-workspace.yaml`、`tsconfig.base.json`（并入 `tsconfig.json`）；根 `package.json` 就是原 `apps/web/package.json` 加上原根级脚本里仍有意义的 `lint/format/typecheck`；删除 `db:*` 脚本（数据库属于后端仓库）。`docs/` 保留。`.gitignore` 相应精简。

### 4.2 契约流

```
"gen:api": "pnpm dlx openapi-typescript@7 ${OPENAPI_SOURCE:-http://localhost:3001/api/openapi.json} -o src/api/schema.d.ts"
```
`src/api/schema.d.ts` **提交**。来源可以是 URL、本地路径（`../job_hunt_back/openapi.json`）或 Windows 机器地址，通过 `OPENAPI_SOURCE` 环境变量传。

### 4.3 `src/api/`

```
schema.d.ts   生成物（paths、components）
types.ts      export type JobListItem = components["schemas"]["JobListItem"]; …（全部 DTO 别名，含 ApiErrorBody）
client.ts     export const client = createClient<paths>({ baseUrl: "/" });
              export class ApiError（不变）
              export async function unwrap<T>(p: Promise<{ data?: T; error?: unknown; response: Response }>): Promise<T>
                — error 存在或 !response.ok → 解析 ApiError（沿用现有 ApiErrorBody 形状判断），204 → undefined as T
queries.ts    client.GET("/api/jobs", { params: { query } }) 等；queryKey 与选项不变
mutations.ts  client.PUT("/api/jobs/{id}/favorite", { params: { path: { id } } }) 等；乐观更新逻辑不变
client.test.ts 现有 5 个 unwrap 测试改为构造 openapi-fetch 形状的返回值
```

`queries.ts` 的 `toQuery`（数字转字符串）删除：openapi-fetch 自己序列化 query。

### 4.4 zod 与 entities

- 前端只保留 `src/routes/-search.ts`：`jobListQuerySchema`（与后端同内容，10 行）供 `validateSearch`。`zod` 仍是依赖。
- `entities/job/index.ts` 与 `entities/quiz/index.ts` 的类型重导出改为来自 `@api/types`；`CATEGORY / CATEGORY_OPTIONS / isCategoryId` 搬到 `entities/job/model/category.ts`（原样）。组件层不改。

### 4.5 运行

开发：`.env.local` 的 `VITE_API_PROXY` 指向后端（本机或 Windows），Vite 代理，不需要 CORS。生产直连时后端 `CORS_ORIGINS` 放行。

## 5. 执行顺序

1. 后端仓库：subtree split → 新仓库 → 根配置 + contract 合并 → `pnpm install && pnpm test` 通过（此时路由还是 Hono RPC 写法）。
2. 后端：contract 改 zod schema（service/测试不动仍通过）。
3. 后端：路由改 createRoute + OpenAPIHono + cors + docs；`pnpm openapi` 生成 `openapi.json`；测试通过；README。
4. 前端：`pnpm gen:api` 生成 `schema.d.ts`；`client/types/queries/mutations` 改 openapi-fetch；entities facade 改；unwrap 测试改；typecheck/lint/test 通过。
5. 前端：目录提升到根、删 workspace 与 `apps/` `packages/`；README/AGENTS 更新；浏览器验收。

## 6. 验收

- 后端：`pnpm typecheck && pnpm lint && pnpm test` 全绿（含 `openapi:check`）；`curl localhost:3001/api/openapi.json | jq '.paths | keys | length'` = 11（12 个端点，favorite / application 各两个方法共享一条路径）；`/api/docs` 能打开；`curl -H "Origin: http://localhost:5173" -I localhost:3001/api/me` 带 `access-control-allow-origin`。
- 前端：`pnpm typecheck && pnpm lint && pnpm test` 全绿；`OPENAPI_SOURCE=../job_hunt_back/openapi.json pnpm gen:api && git diff --exit-code src/api/schema.d.ts` 无差异；`git grep -l "@job-hunt/"` 为空；浏览器看板 6 项 + 刷题 5 项。
- 两个仓库都没有 `apps/`、`packages/`、`pnpm-workspace.yaml`。

## 7. 风险

- `@hono/zod-openapi` 对 zod v4 `z.coerce`/`.default()` 的 OpenAPI 输出可能把 query 参数标成 `number`；`openapi-fetch` 序列化时会 `String()`，无影响。
- `openapi-typescript` 需要 TS 5：通过 `pnpm dlx` 隔离；若 dlx 在离线环境不可用，改为 devDependency `typescript5: npm:typescript@5` 别名并用 `node_modules/typescript5` 运行。
- `subtree split` 后新仓库路径前缀去掉，`load-env.ts` 里 `../../../.env` 要改为 `../.env`（src → 根），`prisma.config.ts` 的 `../../.env` 改为 `./.env`。
