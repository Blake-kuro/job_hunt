# 前后端拆仓 + OpenAPI 契约 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 后端独立成仓库 `Blake-kuro/job_hunt_back`（Hono + `@hono/zod-openapi`，提交 `openapi.json` 作为契约）；前端仓库 `job_hunt_front` 改为普通 Vite 项目，用 `openapi-typescript` 生成类型、`openapi-fetch` 调用。

**Architecture:** 后端 `src/contract` 用 zod（`@hono/zod-openapi` 的 `z`）同时定义请求校验、响应 DTO 与 OpenAPI 组件；路由用 `createRoute` 声明；`scripts/openapi.ts` 生成 `openapi.json`，`pretest` 门禁保证契约与代码一致。前端 `src/api/schema.d.ts` 由后端 `openapi.json` 生成并提交；`client.ts` 用 `openapi-fetch`；组件层通过 `entities/*` facade 取类型，不改。

**Tech Stack:** `@hono/zod-openapi` 1.6、`@hono/swagger-ui` 0.6、`hono/cors`、`openapi-typescript` 7（`pnpm dlx`）、`openapi-fetch` 0.17；其余沿用（Hono 4.13、Prisma 7.10、Vite 8、TanStack、Biome 2.5、TS 7.0.2、pnpm 12.4.1、Node 22）。

**Spec:** `docs/superpowers/specs/2026-09-13-repo-split-openapi-design.md`

## Global Constraints

- 两个仓库、两个工作目录：**后端** `/Users/black/Desktop/job_hunt_back`（Task 1 创建），**前端** `/Users/black/Desktop/job_hunt_front`（分支 `feat/repo-split-openapi`）。每个任务的命令说明在哪个目录执行。
- 每个 shell 命令前缀 `source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && `；只用 pnpm。
- 提交尾行 `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`。
- 数据库：Docker Postgres :5433（已在跑）；`.env` 里 `DATABASE_URL`（`job_hunt`）与 `TEST_DATABASE_URL`（`job_hunt_test`，必须以 `_test` 结尾）。不碰 :5432 与 :3000。验证用 :3001 / :5173，用完杀掉自己起的进程。
- **业务语义零变化**：端点路径/方法、字段名、错误格式 `{ error: { code, message, issues? } }`、状态码 200/204/400/404/500、service 行为全部不变。现有集成测试文件不改仍通过是硬门禁（spec 3.6 允许的例外要在报告里说明原因）。
- OpenAPI：每个端点写 `operationId` 与 `tags`；响应 schema 都 `.openapi("Name")` 注册；`openapi.json` 提交；`openapi:check` 作为 `pretest`。
- 前端只允许 `import type` 生成物；不再有 `@job-hunt/*` 依赖；`zod` 只用于 `validateSearch`。
- 日期边界只经后端 `src/lib/dates.ts`。
- 永不提交 `.env`、`src/generated/`、`dist/`、`node_modules/`。

---

### Task 1: 创建后端仓库 `job_hunt_back`（历史迁移 + 单包配置 + contract 合并）

**Files（后端仓库）:**
- 由 `git subtree split` 带来：`prisma/`、`prisma.config.ts`、`scripts/import-jobs.ts`、`src/**`、`package.json`、`tsconfig.json`、`vitest.config.ts`
- Create: `.nvmrc`、`biome.json`、`.gitignore`、`.env.example`、`docker-compose.yml`、`src/contract/**`（从 front 的 `packages/shared/src` 复制）
- Modify: `package.json`（去 workspace 依赖）、`tsconfig.json`（内联 base）、`src/load-env.ts`、`prisma.config.ts`（.env 路径）、所有 `@job-hunt/shared` 导入 → `../contract`

**Interfaces:**
- Produces: 可独立 `pnpm install && pnpm test` 的后端仓库，`main` 分支已推到 `Blake-kuro/job_hunt_back`。

- [ ] **Step 1: 在前端仓库切出后端历史（在 `job_hunt_front`，当前分支 `feat/repo-split-openapi`）**

```bash
git subtree split -P apps/api -b api-history && git log --oneline api-history | head -5
```
Expected：`api-history` 分支存在，最早的提交是 Task 3 的搬迁提交。

- [ ] **Step 2: 创建 GitHub 仓库并克隆**

```bash
gh repo create Blake-kuro/job_hunt_back --private --description "职寻 · 校园招聘后端 API（Hono + Prisma）"
git clone /Users/black/Desktop/job_hunt_front /Users/black/Desktop/job_hunt_back --branch api-history --single-branch
cd /Users/black/Desktop/job_hunt_back && git branch -m api-history main && git remote set-url origin https://github.com/Blake-kuro/job_hunt_back.git && git remote -v
```
Expected：`origin` 指向 `job_hunt_back`；`ls` 看到 `prisma/ src/ scripts/ package.json`。

- [ ] **Step 3: 根级配置（在 `job_hunt_back`）**

`package.json`（整体替换）：
```json
{
  "name": "job-hunt-back",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@12.4.1",
  "engines": { "node": ">=22" },
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "start": "tsx src/index.ts",
    "typecheck": "tsc --noEmit",
    "lint": "biome check .",
    "format": "biome format --write .",
    "test": "vitest run",
    "db:up": "docker compose up -d",
    "db:migrate": "prisma migrate dev",
    "db:seed": "prisma db seed",
    "db:import": "tsx scripts/import-jobs.ts",
    "postinstall": "prisma generate"
  },
  "dependencies": {
    "@hono/node-server": "^2.1.1",
    "@hono/zod-validator": "^0.9.1",
    "@prisma/adapter-pg": "^7.10.0",
    "@prisma/client": "^7.10.0",
    "dotenv": "^17.4.2",
    "exceljs": "^4.4.0",
    "hono": "^4.13.0",
    "zod": "^4.5.4"
  },
  "devDependencies": {
    "@biomejs/biome": "2.5.13",
    "@types/node": "^22",
    "prisma": "^7.10.0",
    "tsx": "^4.23.13",
    "typescript": "7.0.2",
    "vitest": "^5.0.0"
  }
}
```

`tsconfig.json`（整体替换）：
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2023"],
    "types": ["node"],
    "strict": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "noEmit": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src", "prisma", "scripts", "prisma.config.ts", "vitest.config.ts"],
  "exclude": ["src/generated"]
}
```

从前端仓库复制（内容原样）：`biome.json`、`.nvmrc`、`docker-compose.yml`、`.env.example`。`.gitignore`：
```
node_modules/
.DS_Store
*.log
*.tsbuildinfo
.env*
!.env.example
src/generated/
.superpowers/
```

`src/load-env.ts`：路径改为 `new URL("../.env", import.meta.url)`（src → 根）。
`prisma.config.ts`：`config({ path: fileURLToPath(new URL("./.env", import.meta.url)) })`。

- [ ] **Step 4: contract 合并**

```bash
mkdir -p src/contract && cp -R /Users/black/Desktop/job_hunt_front/packages/shared/src/. src/contract/
grep -rl "@job-hunt/shared" src prisma scripts
```
把每个命中的文件里 `from "@job-hunt/shared"` 改为相对路径（`src/routes/*.ts`、`src/services/*.ts`、`src/lib/*.ts` → `"../contract"`；`prisma/`、`scripts/` 下若有 → `"../src/contract"`）。`src/contract/index.ts` 保持原导出。

- [ ] **Step 5: 安装、门禁**

```bash
cp /Users/black/Desktop/job_hunt_front/.env .env
pnpm install && pnpm typecheck && pnpm exec biome format --write . >/dev/null && pnpm lint && pnpm test
```
Expected：postinstall 生成客户端；typecheck 清零；lint 清零；**64 tests pass**（原 api 58 + shared 6，shared 的两个测试文件跟着 contract 搬来了）。`pnpm db:seed` 成功（幂等）。

- [ ] **Step 6: 提交并推送**

```bash
git add -A && git commit -m "chore: 独立仓库 —— 单包配置，contract 从 shared 合并" && git push -u origin main
cd /Users/black/Desktop/job_hunt_front && git branch -D api-history
```
Expected：GitHub 上 `job_hunt_back` 的 `main` 有完整历史（`git log --oneline | wc -l` ≥ 10）。

---

### Task 2: 后端 contract 改 zod schema（DTO 可进 OpenAPI）

**Files（后端）:**
- Rewrite: `src/contract/index.ts`、`src/contract/common.ts`（原 `http.ts`）、`src/contract/job.ts`（合并原 `job/{category,query,types}.ts`）、`src/contract/quiz.ts`（合并原 `quiz/{schema,types}.ts`）、`src/contract/user.ts`（新）
- Move: `src/contract/job/query.test.ts` → `src/contract/job.test.ts`；`src/contract/quiz/schema.test.ts` → `src/contract/quiz.test.ts`
- Delete: `src/contract/job/`、`src/contract/quiz/`、`src/contract/http.ts`
- Modify: `src/services/*.ts`、`src/lib/job-dto.ts`、`src/lib/job-row.ts`、`src/routes/*.ts` 的导入名（只改导入，不改逻辑）

**Interfaces:**
- Produces（`src/contract/index.ts` 全部导出）：`ApiErrorSchema, ApiErrorBody, ApiErrorCode`；`CategoryIdSchema, CategoryId, CATEGORY, CATEGORY_OPTIONS, isCategoryId, jobListQuerySchema, JobListQuery, ApplicationStatusSchema, ApplicationStatus, JobListItemSchema, JobListItem, JobListResultSchema, JobListResult, JobProgressSchema, JobProgress, IdParamSchema, ApplicationBodySchema, FavoriteResultSchema, ApplicationResultSchema`；`QuizOptionLetterSchema, QuizOptionLetter, QuizOptionSchema, QuizOption, quizOptionsSchema, SubmitAttemptSchema, SubmitAttemptInput, SetMasteredSchema, QuizQuestionPublicSchema, QuizQuestionPublic, QuizTodaySchema, QuizToday, QuizAnswerResultSchema, QuizAnswerResult, WrongBookItemSchema, WrongBookItem, WeekLabel, QuizDashboardSchema, QuizDashboard, CompanySetItemSchema, CompanySetItem, QuestionIdParamSchema, WrongBookListSchema, CompanySetListSchema`；`UserSchema, User`。
- 兼容别名（旧名字继续可用，避免改 service）：`submitAttemptSchema = SubmitAttemptSchema`、`setMasteredSchema = SetMasteredSchema`、`quizOptionLetterSchema`、`quizOptionSchema`。

- [ ] **Step 1: 安装 zod-openapi**

```bash
pnpm add @hono/zod-openapi@^1.6.3
```

- [ ] **Step 2: `src/contract/common.ts`**

```ts
import { z } from "@hono/zod-openapi";

export const ApiErrorCodeSchema = z.enum(["VALIDATION", "NOT_FOUND", "INTERNAL"]).openapi("ApiErrorCode");
export type ApiErrorCode = z.infer<typeof ApiErrorCodeSchema>;

export const ApiErrorSchema = z
  .object({
    error: z.object({
      code: ApiErrorCodeSchema,
      message: z.string(),
      issues: z.array(z.unknown()).optional(),
    }),
  })
  .openapi("ApiError");
export type ApiErrorBody = z.infer<typeof ApiErrorSchema>;
```

- [ ] **Step 3: `src/contract/job.ts`**

```ts
import { z } from "@hono/zod-openapi";

export const CategoryIdSchema = z.union([z.literal(1), z.literal(2), z.literal(3)]).openapi("CategoryId");
export type CategoryId = z.infer<typeof CategoryIdSchema>;

export const CATEGORY: Record<CategoryId, string> = { 1: "秋招与实习", 2: "央国企", 3: "外企" };

export const CATEGORY_OPTIONS = [
  { value: "all", label: "全部" },
  { value: "1", label: CATEGORY[1] },
  { value: "2", label: CATEGORY[2] },
  { value: "3", label: CATEGORY[3] },
] as const;

export function isCategoryId(n: number): n is CategoryId {
  return n === 1 || n === 2 || n === 3;
}

export const jobListQuerySchema = z
  .object({
    category: z.coerce.number().pipe(CategoryIdSchema).optional(),
    city: z.string().trim().min(1).optional(),
    q: z.string().trim().min(1).optional(),
    sort: z.enum(["deadline", "posted"]).default("deadline"),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .openapi("JobListQuery");
export type JobListQuery = z.infer<typeof jobListQuerySchema>;

export const ApplicationStatusSchema = z.enum(["APPLIED", "INTERVIEWING"]).openapi("ApplicationStatus");
export type ApplicationStatus = z.infer<typeof ApplicationStatusSchema>;

export const JobListItemSchema = z
  .object({
    id: z.number().int(),
    company: z.string(),
    category: CategoryIdSchema,
    categoryLabel: z.string(),
    positions: z.array(z.string()),
    cities: z.array(z.string()),
    degree: z.string().nullable(),
    industry: z.string().nullable(),
    batch: z.string().nullable(),
    graduationYear: z.string().nullable(),
    deadlineText: z.string().nullable(),
    deadlineAt: z.string().nullable(),
    daysLeft: z.number().int().nullable(),
    postedAt: z.string(),
    announcementLink: z.string().nullable(),
    deliveryAddress: z.string().nullable(),
    starred: z.boolean(),
    applicationStatus: ApplicationStatusSchema.nullable(),
  })
  .openapi("JobListItem");
export type JobListItem = z.infer<typeof JobListItemSchema>;

export const JobListResultSchema = z
  .object({ items: z.array(JobListItemSchema), total: z.number().int(), page: z.number().int(), pageSize: z.number().int() })
  .openapi("JobListResult");
export type JobListResult = z.infer<typeof JobListResultSchema>;

export const JobProgressSchema = z
  .object({
    starred: z.number().int(),
    applied: z.number().int(),
    interviewing: z.number().int(),
    newThisWeek: z.number().int(),
    newInternshipsThisWeek: z.number().int(),
    nextDeadline: z.object({ jobId: z.number().int(), company: z.string(), daysLeft: z.number().int() }).nullable(),
  })
  .openapi("JobProgress");
export type JobProgress = z.infer<typeof JobProgressSchema>;

export const IdParamSchema = z.object({
  id: z.coerce.number().int().positive().openapi({ param: { name: "id", in: "path" }, example: 1 }),
});
export const ApplicationBodySchema = z.object({ status: ApplicationStatusSchema }).openapi("ApplicationBody");
export const FavoriteResultSchema = z.object({ starred: z.boolean() }).openapi("FavoriteResult");
export const ApplicationResultSchema = z
  .object({ applicationStatus: ApplicationStatusSchema.nullable() })
  .openapi("ApplicationResult");
```

- [ ] **Step 4: `src/contract/quiz.ts`**

```ts
import { z } from "@hono/zod-openapi";

export const QuizOptionLetterSchema = z.enum(["A", "B", "C", "D"]).openapi("QuizOptionLetter");
export type QuizOptionLetter = z.infer<typeof QuizOptionLetterSchema>;

export const QuizOptionSchema = z
  .object({ letter: QuizOptionLetterSchema, text: z.string().min(1) })
  .openapi("QuizOption");
export type QuizOption = z.infer<typeof QuizOptionSchema>;

/** Question.options（Json 列）的形状：固定 4 项 */
export const quizOptionsSchema = z.array(QuizOptionSchema).length(4);

export const SubmitAttemptSchema = z
  .object({ questionId: z.string().min(1), picked: QuizOptionLetterSchema })
  .openapi("SubmitAttempt");
export type SubmitAttemptInput = z.infer<typeof SubmitAttemptSchema>;

export const SetMasteredSchema = z.object({ mastered: z.boolean() }).openapi("SetMastered");

export const QuizQuestionPublicSchema = z
  .object({
    id: z.string(),
    prompt: z.string(),
    options: z.array(QuizOptionSchema),
    category: z.string(),
    difficulty: z.string(),
    source: z.string(),
  })
  .openapi("QuizQuestionPublic");
export type QuizQuestionPublic = z.infer<typeof QuizQuestionPublicSchema>;

export const QuizTodaySchema = z
  .object({
    question: QuizQuestionPublicSchema.nullable(),
    indexLabel: z.string(),
    attemptedToday: z.number().int(),
    date: z.string(),
  })
  .openapi("QuizToday");
export type QuizToday = z.infer<typeof QuizTodaySchema>;

export const QuizAnswerResultSchema = z
  .object({
    correct: z.boolean(),
    answer: QuizOptionLetterSchema,
    explanation: z.array(z.string()),
    accuracyRate: z.number().int().nullable(),
  })
  .openapi("QuizAnswerResult");
export type QuizAnswerResult = z.infer<typeof QuizAnswerResultSchema>;

export const WrongBookItemSchema = z
  .object({ questionId: z.string(), title: z.string(), due: z.string() })
  .openapi("WrongBookItem");
export type WrongBookItem = z.infer<typeof WrongBookItemSchema>;

export const WeekLabelSchema = z.enum(["一", "二", "三", "四", "五", "六", "日"]);
export type WeekLabel = z.infer<typeof WeekLabelSchema>;

export const QuizDashboardSchema = z
  .object({
    streakDays: z.number().int(),
    week: z.array(z.object({ label: WeekLabelSchema, done: z.boolean() })),
    weekSolved: z.number().int(),
    weekTarget: z.number().int(),
    totalSolved: z.number().int(),
    categories: z.array(z.object({ id: z.string(), label: z.string(), count: z.number().int() })),
    wrongList: z.array(WrongBookItemSchema),
  })
  .openapi("QuizDashboard");
export type QuizDashboard = z.infer<typeof QuizDashboardSchema>;

export const CompanySetItemSchema = z
  .object({ id: z.string(), company: z.string(), track: z.string(), focus: z.string(), count: z.number().int() })
  .openapi("CompanySetItem");
export type CompanySetItem = z.infer<typeof CompanySetItemSchema>;

export const QuestionIdParamSchema = z.object({
  questionId: z.string().min(1).openapi({ param: { name: "questionId", in: "path" }, example: "q-001" }),
});
export const WrongBookListSchema = z.object({ items: z.array(WrongBookItemSchema) }).openapi("WrongBookList");
export const CompanySetListSchema = z.object({ items: z.array(CompanySetItemSchema) }).openapi("CompanySetList");

// 兼容旧名字（service / 旧路由沿用）
export const quizOptionLetterSchema = QuizOptionLetterSchema;
export const quizOptionSchema = QuizOptionSchema;
export const submitAttemptSchema = SubmitAttemptSchema;
export const setMasteredSchema = SetMasteredSchema;
```

- [ ] **Step 5: `src/contract/user.ts` 与 `index.ts`**

```ts
// user.ts
import { z } from "@hono/zod-openapi";
export const UserSchema = z.object({ id: z.string(), email: z.string(), name: z.string() }).openapi("User");
export type User = z.infer<typeof UserSchema>;
```

```ts
// index.ts
export * from "./common";
export * from "./job";
export * from "./quiz";
export * from "./user";
```

- [ ] **Step 6: 测试文件搬家并调整导入**

`git mv src/contract/job/query.test.ts src/contract/job.test.ts`（`from "./query"` → `from "./job"`）；`git mv src/contract/quiz/schema.test.ts src/contract/quiz.test.ts`（`from "./schema"` → `from "./quiz"`）；`git rm -r src/contract/job src/contract/quiz src/contract/http.ts`。

`services/users.ts`：返回类型改 `Promise<User>`（导入自 `../contract`）。其余 services / lib / routes 的导入名不变（都还在导出）。

- [ ] **Step 7: 门禁**

```bash
pnpm typecheck && pnpm exec biome format --write src >/dev/null && pnpm lint && pnpm test
```
Expected：**64 tests pass**，路由/服务文件除导入外零改动（`git diff --stat src/services src/routes src/lib` 只有 import 行）。

- [ ] **Step 8: 提交**

```bash
git add -A && git commit -m "refactor(contract): DTO 改为 zod schema 并注册 OpenAPI 组件"
```

---

### Task 3: 后端路由改 `OpenAPIHono` + `createRoute`、CORS、Swagger、`openapi.json` 门禁、README

**Files（后端）:**
- Rewrite: `src/app.ts`、`src/routes/me.ts`、`src/routes/jobs.ts`、`src/routes/quiz.ts`、`src/lib/errors.ts`（`validationHook` 签名）
- Create: `scripts/openapi.ts`、`openapi.json`（生成）、`README.md`（整体替换）
- Modify: `package.json`（脚本、依赖）、`.env.example`
- Delete dependency: `@hono/zod-validator`

**Interfaces:**
- Produces: `GET /api/openapi.json`（OpenAPI 3.1）、`GET /api/docs`（Swagger UI）；`openapi.json` 文件；`operationId`：`getMe, listJobs, getJobProgress, addFavorite, removeFavorite, setApplication, clearApplication, getTodayQuestion, submitAttempt, getQuizDashboard, listWrongBook, setWrongBookMastered, listCompanySets`。

- [ ] **Step 1: 依赖与脚本**

```bash
pnpm add @hono/swagger-ui@^0.6.1 && pnpm remove @hono/zod-validator
```
`package.json` scripts 加：
```json
"openapi": "tsx scripts/openapi.ts",
"openapi:check": "pnpm openapi && git diff --exit-code -- openapi.json",
"pretest": "pnpm openapi:check"
```
`.env.example` 加：
```
PORT=3001
# 允许的前端源，逗号分隔；Vite 代理模式下不需要
CORS_ORIGINS=http://localhost:5173
```

- [ ] **Step 2: `src/lib/errors.ts`（validationHook 改为 zod-openapi 的 defaultHook）**

```ts
import type { Hook } from "@hono/zod-openapi";
import type { ErrorHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import type { Env } from "../env";

export class NotFoundError extends Error {
  constructor(message = "not found") {
    super(message);
    this.name = "NotFoundError";
  }
}

/** OpenAPIHono 的 defaultHook：校验失败统一 400 */
// biome-ignore lint/suspicious/noExplicitAny: 对所有路由生效的通用 hook
export const validationHook: Hook<any, Env, any, any> = (result, c) => {
  if (!result.success) {
    return c.json({ error: { code: "VALIDATION" as const, message: "参数校验失败", issues: result.error.issues } }, 400);
  }
};

export const errorHandler: ErrorHandler<Env> = (err, c) => {
  if (err instanceof HTTPException && err.status === 400) {
    return c.json({ error: { code: "VALIDATION", message: "请求 JSON 格式无效" } }, 400);
  }
  if (err instanceof NotFoundError) {
    return c.json({ error: { code: "NOT_FOUND", message: err.message } }, 404);
  }
  console.error(err);
  return c.json({ error: { code: "INTERNAL", message: "服务器内部错误" } }, 500);
};
```
若 `Hook` 的泛型个数与 1.6.3 的类型定义不符，按 `node_modules/@hono/zod-openapi/dist/index.d.ts` 里的定义调整泛型参数，保持 `any` + biome-ignore。

- [ ] **Step 3: `src/routes/me.ts`**

```ts
import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { UserSchema } from "../contract";
import type { Env } from "../env";
import { validationHook } from "../lib/errors";
import { getCurrentUser } from "../services/users";

const getMe = createRoute({
  method: "get",
  path: "/",
  tags: ["me"],
  operationId: "getMe",
  responses: { 200: { description: "当前用户", content: { "application/json": { schema: UserSchema } } } },
});

export const meRoutes = new OpenAPIHono<Env>({ defaultHook: validationHook }).openapi(getMe, async (c) =>
  c.json(await getCurrentUser(c.var.userId), 200),
);
```

- [ ] **Step 4: `src/routes/jobs.ts`**

```ts
import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import {
  ApiErrorSchema,
  ApplicationBodySchema,
  ApplicationResultSchema,
  FavoriteResultSchema,
  IdParamSchema,
  JobListResultSchema,
  JobProgressSchema,
  jobListQuerySchema,
} from "../contract";
import type { Env } from "../env";
import { validationHook } from "../lib/errors";
import { getProgress, listJobs, setApplication, setFavorite } from "../services/jobs";

const json = <S>(schema: S, description: string) => ({ description, content: { "application/json": { schema } } });
const badRequest = json(ApiErrorSchema, "参数校验失败");
const notFound = json(ApiErrorSchema, "岗位不存在");

const listJobsRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["jobs"],
  operationId: "listJobs",
  request: { query: jobListQuerySchema },
  responses: { 200: json(JobListResultSchema, "岗位列表"), 400: badRequest },
});

const progressRoute = createRoute({
  method: "get",
  path: "/progress",
  tags: ["jobs"],
  operationId: "getJobProgress",
  responses: { 200: json(JobProgressSchema, "我的进度") },
});

const addFavoriteRoute = createRoute({
  method: "put",
  path: "/{id}/favorite",
  tags: ["jobs"],
  operationId: "addFavorite",
  request: { params: IdParamSchema },
  responses: { 200: json(FavoriteResultSchema, "已收藏"), 400: badRequest, 404: notFound },
});

const removeFavoriteRoute = createRoute({
  method: "delete",
  path: "/{id}/favorite",
  tags: ["jobs"],
  operationId: "removeFavorite",
  request: { params: IdParamSchema },
  responses: { 200: json(FavoriteResultSchema, "已取消收藏"), 400: badRequest, 404: notFound },
});

const setApplicationRoute = createRoute({
  method: "put",
  path: "/{id}/application",
  tags: ["jobs"],
  operationId: "setApplication",
  request: { params: IdParamSchema, body: { content: { "application/json": { schema: ApplicationBodySchema } } } },
  responses: { 200: json(ApplicationResultSchema, "投递状态"), 400: badRequest, 404: notFound },
});

const clearApplicationRoute = createRoute({
  method: "delete",
  path: "/{id}/application",
  tags: ["jobs"],
  operationId: "clearApplication",
  request: { params: IdParamSchema },
  responses: { 200: json(ApplicationResultSchema, "已清除投递状态"), 400: badRequest, 404: notFound },
});

export const jobRoutes = new OpenAPIHono<Env>({ defaultHook: validationHook })
  .openapi(listJobsRoute, async (c) => c.json(await listJobs(c.req.valid("query"), c.var.userId), 200))
  .openapi(progressRoute, async (c) => c.json(await getProgress(c.var.userId), 200))
  .openapi(addFavoriteRoute, async (c) => c.json(await setFavorite(c.req.valid("param").id, c.var.userId, true), 200))
  .openapi(removeFavoriteRoute, async (c) =>
    c.json(await setFavorite(c.req.valid("param").id, c.var.userId, false), 200),
  )
  .openapi(setApplicationRoute, async (c) =>
    c.json(await setApplication(c.req.valid("param").id, c.var.userId, c.req.valid("json").status), 200),
  )
  .openapi(clearApplicationRoute, async (c) =>
    c.json(await setApplication(c.req.valid("param").id, c.var.userId, null), 200),
  );
```

- [ ] **Step 5: `src/routes/quiz.ts`**

```ts
import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import {
  ApiErrorSchema,
  CompanySetListSchema,
  QuestionIdParamSchema,
  QuizAnswerResultSchema,
  QuizDashboardSchema,
  QuizTodaySchema,
  SetMasteredSchema,
  SubmitAttemptSchema,
  WrongBookListSchema,
} from "../contract";
import type { Env } from "../env";
import { validationHook } from "../lib/errors";
import {
  getDashboard,
  getTodayQuestion,
  listCompanySets,
  listWrongBook,
  setMastered,
  submitAnswer,
} from "../services/quiz";

const json = <S>(schema: S, description: string) => ({ description, content: { "application/json": { schema } } });
const badRequest = json(ApiErrorSchema, "参数校验失败");
const notFound = json(ApiErrorSchema, "不存在");

const todayRoute = createRoute({
  method: "get",
  path: "/today",
  tags: ["quiz"],
  operationId: "getTodayQuestion",
  responses: { 200: json(QuizTodaySchema, "今日一题") },
});

const attemptsRoute = createRoute({
  method: "post",
  path: "/attempts",
  tags: ["quiz"],
  operationId: "submitAttempt",
  request: { body: { content: { "application/json": { schema: SubmitAttemptSchema } } } },
  responses: { 200: json(QuizAnswerResultSchema, "判题结果"), 400: badRequest, 404: notFound },
});

const dashboardRoute = createRoute({
  method: "get",
  path: "/dashboard",
  tags: ["quiz"],
  operationId: "getQuizDashboard",
  responses: { 200: json(QuizDashboardSchema, "打卡仪表盘") },
});

const wrongBookRoute = createRoute({
  method: "get",
  path: "/wrong-book",
  tags: ["quiz"],
  operationId: "listWrongBook",
  responses: { 200: json(WrongBookListSchema, "错题本") },
});

const setMasteredRoute = createRoute({
  method: "put",
  path: "/wrong-book/{questionId}",
  tags: ["quiz"],
  operationId: "setWrongBookMastered",
  request: { params: QuestionIdParamSchema, body: { content: { "application/json": { schema: SetMasteredSchema } } } },
  responses: { 204: { description: "已更新" }, 400: badRequest, 404: notFound },
});

const companySetsRoute = createRoute({
  method: "get",
  path: "/company-sets",
  tags: ["quiz"],
  operationId: "listCompanySets",
  responses: { 200: json(CompanySetListSchema, "公司题集") },
});

export const quizRoutes = new OpenAPIHono<Env>({ defaultHook: validationHook })
  .openapi(todayRoute, async (c) => c.json(await getTodayQuestion(c.var.userId), 200))
  .openapi(attemptsRoute, async (c) => {
    const { questionId, picked } = c.req.valid("json");
    return c.json(await submitAnswer(c.var.userId, questionId, picked), 200);
  })
  .openapi(dashboardRoute, async (c) => c.json(await getDashboard(c.var.userId), 200))
  .openapi(wrongBookRoute, async (c) => c.json({ items: await listWrongBook(c.var.userId) }, 200))
  .openapi(setMasteredRoute, async (c) => {
    await setMastered(c.var.userId, c.req.valid("param").questionId, c.req.valid("json").mastered);
    return c.body(null, 204);
  })
  .openapi(companySetsRoute, async (c) => c.json({ items: await listCompanySets() }, 200));
```

- [ ] **Step 6: `src/app.ts`（不用 basePath，改为把 `/api` 子应用挂到根，保证文档路径带 `/api` 前缀）**

```ts
import { swaggerUI } from "@hono/swagger-ui";
import { OpenAPIHono } from "@hono/zod-openapi";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { requestUser } from "./auth";
import type { Env } from "./env";
import { errorHandler, validationHook } from "./lib/errors";
import { jobRoutes } from "./routes/jobs";
import { meRoutes } from "./routes/me";
import { quizRoutes } from "./routes/quiz";

export const OPENAPI_INFO = {
  openapi: "3.1.0",
  info: { title: "job_hunt_back", version: "0.1.0", description: "职寻 · 校园招聘岗位与刷题 API" },
} as const;

function corsOrigins(): string[] {
  return (process.env.CORS_ORIGINS ?? "http://localhost:5173")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

const api = new OpenAPIHono<Env>({ defaultHook: validationHook })
  .use(requestUser)
  .route("/me", meRoutes)
  .route("/jobs", jobRoutes)
  .route("/quiz", quizRoutes);

const app = new OpenAPIHono<Env>({ defaultHook: validationHook })
  .use(cors({ origin: corsOrigins() }))
  .use(process.env.NODE_ENV === "test" ? async (_c, next) => next() : logger())
  .route("/api", api)
  .notFound((c) => c.json({ error: { code: "NOT_FOUND", message: "接口不存在" } }, 404))
  .onError(errorHandler);

app.doc31("/api/openapi.json", OPENAPI_INFO);
app.get("/api/docs", swaggerUI({ url: "/api/openapi.json" }));

export default app;
```
注意：`requestUser` 挂在 `api` 上，所以 `/api/openapi.json` 与 `/api/docs` 不经过用户查询（无库也能打开）。若 `.route("/api", api)` 合并后 `openapi.json` 的 paths 缺少 `/api` 前缀或缺少子应用的路由，按 `node_modules/@hono/zod-openapi/README.md`"Combining with Hono"一节调整，并在报告写明。

- [ ] **Step 7: `scripts/openapi.ts`**

```ts
import { writeFileSync } from "node:fs";
import app, { OPENAPI_INFO } from "../src/app";

const doc = app.getOpenAPI31Document(OPENAPI_INFO);
writeFileSync("openapi.json", `${JSON.stringify(doc, null, 2)}\n`);
console.log(`openapi.json：${Object.keys(doc.paths ?? {}).length} 条路径`);
```

- [ ] **Step 8: 生成、门禁、冒烟**

```bash
pnpm openapi && node -e 'const d=require("./openapi.json");console.log(Object.keys(d.paths).sort().join("\n"));console.log(Object.keys(d.components.schemas).length,"schemas")'
pnpm typecheck && pnpm exec biome format --write . >/dev/null && pnpm lint && pnpm test
```
Expected：11 条路径，全部以 `/api/` 开头：`/api/jobs`、`/api/jobs/progress`、`/api/jobs/{id}/favorite`、`/api/jobs/{id}/application`、`/api/me`、`/api/quiz/today`、`/api/quiz/attempts`、`/api/quiz/dashboard`、`/api/quiz/wrong-book`、`/api/quiz/wrong-book/{questionId}`、`/api/quiz/company-sets`；≥ 18 个 schemas；`pnpm test` 先跑 `openapi:check` 再跑 vitest，**64 pass，测试文件零改动**。

```bash
(pnpm dev > /tmp/back-dev.log 2>&1 &) ; sleep 4
curl -s -o /dev/null -w "%{http_code}\n" localhost:3001/api/docs
curl -s -H "Origin: http://localhost:5173" -I localhost:3001/api/me | grep -i access-control-allow-origin
curl -s localhost:3001/api/jobs/abc/favorite -X PUT; echo
pkill -f "tsx watch src/index.ts"; lsof -i :3001 | wc -l
```
Expected：`200`；`access-control-allow-origin: http://localhost:5173`；`{"error":{"code":"VALIDATION",...}}`；最后 `0`。

- [ ] **Step 9: README.md（整体替换）**

```markdown
# job_hunt_back

职寻 · 校园招聘岗位与刷题的后端 API。Hono 4 + Prisma 7 + PostgreSQL，Node 22，pnpm。

## 启动

```bash
nvm use && corepack enable pnpm && pnpm install
cp .env.example .env          # DATABASE_URL / TEST_DATABASE_URL / PORT / CORS_ORIGINS
pnpm db:up && pnpm db:migrate && pnpm db:seed
pnpm db:import /absolute/path/岗位.xlsx
pnpm dev                      # http://localhost:3001
```

- 接口文档：http://localhost:3001/api/docs （Swagger UI）
- OpenAPI 3.1：http://localhost:3001/api/openapi.json ，同一份提交在仓库根 `openapi.json`

## 契约

`openapi.json` 是对外契约。改了路由或 `src/contract` 后运行 `pnpm openapi` 重新生成并一起提交；`pnpm test` 会先校验生成结果与提交文件一致（`openapi:check`）。

前端 / 其他项目消费方式：`openapi-typescript openapi.json -o schema.d.ts`，或任何 OpenAPI 客户端生成器。

## 约定

- 错误统一 `{ error: { code: VALIDATION | NOT_FOUND | INTERNAL, message, issues? } }`；200 / 204 / 400 / 404 / 500。
- 当前无登录：所有请求以种子账号 `dev@local` 身份执行（`src/auth.ts` 的 `requestUser`）。
- 跨域：`CORS_ORIGINS` 逗号分隔；前端走 Vite 代理时不需要。
- 时区 Asia/Shanghai：日期边界只经 `src/lib/dates.ts`。

## 测试

集成测试打真库且会清空业务表，只接受以 `_test` 结尾的 `TEST_DATABASE_URL`：

```bash
docker compose exec db createdb -U postgres job_hunt_test
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/job_hunt_test pnpm exec prisma migrate deploy
pnpm test
```

## Excel 导入

多工作表；表名含"秋招/实习"→分类 1，"央国企/国企"→2，"外企"→3。有 `id` 列按 id upsert（之后按提示执行 `setval`），否则按 `serialNumber`，再否则插入。
```

- [ ] **Step 10: 提交并推送**

```bash
git add -A && git commit -m "feat(api): OpenAPIHono + createRoute，生成并提交 openapi.json，CORS，Swagger UI" && git push
```

---

### Task 4: 前端 api 层换 openapi-fetch（仍在 monorepo 目录结构内）

**Files（前端仓库 `job_hunt_front`，分支 `feat/repo-split-openapi`，目录 `apps/web`）:**
- Create: `apps/web/src/api/schema.d.ts`（生成）、`apps/web/src/api/types.ts`、`apps/web/src/routes/-search.ts`、`apps/web/src/entities/job/model/category.ts`
- Rewrite: `apps/web/src/api/client.ts`、`queries.ts`、`mutations.ts`、`client.test.ts`、`entities/job/index.ts`、`entities/quiz/index.ts`
- Modify: `apps/web/src/routes/index.tsx`、`apps/web/src/views/job-board/JobBoardPage.tsx`、`apps/web/src/entities/job/model/ui.ts`（导入来源）、`apps/web/package.json`

**Interfaces:**
- Consumes: `/Users/black/Desktop/job_hunt_back/openapi.json`。
- Produces: `client`、`ApiError`、`unwrap`、五个 query 工厂与四个 mutation hook（签名不变）；`@api/types` 导出全部 DTO 别名。

- [ ] **Step 1: 依赖与生成脚本（在 `apps/web`）**

```bash
pnpm remove @job-hunt/shared @job-hunt/api hono && pnpm add openapi-fetch@^0.17.0 && pnpm add -D hono@^4.13.0
```
（`hono` 只在 `client.test.ts` 里当测试服务器用。）`package.json` scripts 加：
```json
"gen:api": "pnpm dlx openapi-typescript@7 \"${OPENAPI_SOURCE:-http://localhost:3001/api/openapi.json}\" -o src/api/schema.d.ts"
```
生成：
```bash
OPENAPI_SOURCE=/Users/black/Desktop/job_hunt_back/openapi.json pnpm gen:api && head -20 src/api/schema.d.ts
```
Expected：文件以 `export interface paths {` 开头，含 `"/api/jobs"` 等 11 个键和 `components.schemas.JobListItem` 等。

- [ ] **Step 2: `src/api/types.ts`**

```ts
import type { components } from "./schema";

type S = components["schemas"];

export type ApiErrorBody = S["ApiError"];
export type ApiErrorCode = S["ApiErrorCode"];
export type CategoryId = S["CategoryId"];
export type ApplicationStatus = S["ApplicationStatus"];
export type JobListQuery = S["JobListQuery"];
export type JobListItem = S["JobListItem"];
export type JobListResult = S["JobListResult"];
export type JobProgress = S["JobProgress"];
export type QuizOptionLetter = S["QuizOptionLetter"];
export type QuizOption = S["QuizOption"];
export type QuizQuestionPublic = S["QuizQuestionPublic"];
export type QuizToday = S["QuizToday"];
export type QuizAnswerResult = S["QuizAnswerResult"];
export type WrongBookItem = S["WrongBookItem"];
export type QuizDashboard = S["QuizDashboard"];
export type CompanySetItem = S["CompanySetItem"];
```
若生成物里 `JobListQuery` 的 `sort/page/pageSize` 因 `.default()` 变成可选，`JobListQuery` 改为 `Required<Pick<S["JobListQuery"], "sort" | "page" | "pageSize">> & Omit<S["JobListQuery"], "sort" | "page" | "pageSize">`，并在报告说明。

- [ ] **Step 3: `src/api/client.ts`**

```ts
import createClient from "openapi-fetch";
import type { paths } from "./schema";
import type { ApiErrorBody } from "./types";

export const client = createClient<paths>({ baseUrl: "/" });

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: ApiErrorBody,
  ) {
    super(body.error.message);
    this.name = "ApiError";
  }
}

const CODES = ["VALIDATION", "NOT_FOUND", "INTERNAL"];

function toErrorBody(value: unknown, status: number): ApiErrorBody {
  if (
    value &&
    typeof value === "object" &&
    "error" in value &&
    value.error &&
    typeof value.error === "object" &&
    "message" in value.error &&
    typeof value.error.message === "string" &&
    "code" in value.error &&
    CODES.includes(String(value.error.code))
  ) {
    return value as ApiErrorBody;
  }
  return { error: { code: "INTERNAL", message: `HTTP ${status}` } };
}

interface FetchResult<T> {
  data?: T;
  error?: unknown;
  response: Response;
}

/** 解包 openapi-fetch 结果：非 2xx 抛 ApiError；204 返回 undefined */
export async function unwrap<T>(p: Promise<FetchResult<T>>): Promise<T> {
  const { data, error, response } = await p;
  if (!response.ok || error !== undefined) throw new ApiError(response.status, toErrorBody(error, response.status));
  return data as T;
}
```

- [ ] **Step 4: `src/api/queries.ts`**

```ts
import { queryOptions } from "@tanstack/react-query";
import { client, unwrap } from "./client";
import type { JobListQuery } from "./types";

export const jobsQuery = (q: JobListQuery) =>
  queryOptions({
    queryKey: ["jobs", "list", q] as const,
    queryFn: () => unwrap(client.GET("/api/jobs", { params: { query: q } })),
  });

export const progressQuery = () =>
  queryOptions({ queryKey: ["jobs", "progress"] as const, queryFn: () => unwrap(client.GET("/api/jobs/progress")) });

export const quizTodayQuery = () =>
  queryOptions({
    staleTime: Number.POSITIVE_INFINITY,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryKey: ["quiz", "today"] as const,
    queryFn: () => unwrap(client.GET("/api/quiz/today")),
  });

export const quizDashboardQuery = () =>
  queryOptions({ queryKey: ["quiz", "dashboard"] as const, queryFn: () => unwrap(client.GET("/api/quiz/dashboard")) });

export const companySetsQuery = () =>
  queryOptions({
    queryKey: ["quiz", "company-sets"] as const,
    queryFn: () => unwrap(client.GET("/api/quiz/company-sets")),
  });
```
若生成的 query 参数类型与 `JobListQuery` 不完全匹配（例如 `category` 被标成 `number`），在 `params.query` 处用 `{ ...q }` 并按 TS 报错做最小的显式类型收窄，不得用 `as any`。

- [ ] **Step 5: `src/api/mutations.ts`**

把四个 hook 里的调用替换为（其余 onMutate / onError / onSettled 逻辑原样）：
```ts
// useToggleFavorite.mutationFn
({ id, starred }: { id: number; starred: boolean }) =>
  unwrap(
    starred
      ? client.PUT("/api/jobs/{id}/favorite", { params: { path: { id } } })
      : client.DELETE("/api/jobs/{id}/favorite", { params: { path: { id } } }),
  ),
// useMarkApplied.mutationFn
({ id }: { id: number }) =>
  unwrap(client.PUT("/api/jobs/{id}/application", { params: { path: { id } }, body: { status } })),
// useSubmitAttempt.mutationFn
(vars: { questionId: string; picked: QuizOptionLetter }) => unwrap(client.POST("/api/quiz/attempts", { body: vars })),
// useSetMastered.mutationFn
({ questionId, mastered }: { questionId: string; mastered: boolean }) =>
  unwrap(client.PUT("/api/quiz/wrong-book/{questionId}", { params: { path: { questionId } }, body: { mastered } })),
```
类型导入改为 `import type { ApplicationStatus, JobListQuery, JobListResult, QuizDashboard, QuizOptionLetter } from "./types";`。

- [ ] **Step 6: `src/api/client.test.ts`（用 openapi-fetch + Hono 测试服务器）**

```ts
import { Hono } from "hono";
import createClient from "openapi-fetch";
import { describe, expect, it } from "vitest";
import { ApiError, unwrap } from "./client";

const app = new Hono()
  .get("/ok", (c) => c.json({ value: 42 }))
  .put("/empty", (c) => c.body(null, 204))
  .get("/invalid", (c) => c.json({ error: { code: "VALIDATION", message: "参数无效" } }, 400))
  .get("/proxy-error", (c) => c.text("Bad Gateway", 502))
  .get("/unexpected", (c) => c.json({ message: "unexpected envelope" }, 500));

type TestPaths = {
  "/ok": { get: { responses: { 200: { content: { "application/json": { value: number } } } } } };
  "/empty": { put: { responses: { 204: { content: never } } } };
  "/invalid": { get: { responses: { 400: { content: { "application/json": unknown } } } } };
  "/proxy-error": { get: { responses: { 502: { content: { "text/plain": string } } } } };
  "/unexpected": { get: { responses: { 500: { content: { "application/json": unknown } } } } };
};

const client = createClient<TestPaths>({ baseUrl: "http://localhost", fetch: (req) => app.request(req) });

describe("openapi-fetch response unwrapping", () => {
  it("preserves the successful response value", async () => {
    const data: { value: number } = await unwrap(client.GET("/ok"));
    expect(data).toEqual({ value: 42 });
  });

  it("returns undefined for 204", async () => {
    expect(await unwrap(client.PUT("/empty"))).toBeUndefined();
  });

  it("preserves structured API errors", async () => {
    await expect(unwrap(client.GET("/invalid"))).rejects.toMatchObject({ name: "ApiError", status: 400, message: "参数无效" });
  });

  it("handles non-JSON proxy failures", async () => {
    await expect(unwrap(client.GET("/proxy-error"))).rejects.toThrow(ApiError);
    await expect(unwrap(client.GET("/proxy-error"))).rejects.toMatchObject({ status: 502, message: "HTTP 502" });
  });

  it("handles unexpected JSON error bodies", async () => {
    await expect(unwrap(client.GET("/unexpected"))).rejects.toMatchObject({ status: 500, message: "HTTP 500" });
  });
});
```
若 `TestPaths` 手写类型让 `client.GET` 报类型错误，把该类型放宽到 openapi-fetch 要求的最小形状（看 `node_modules/openapi-fetch/dist/index.d.ts`），测试断言不变。

- [ ] **Step 7: zod 搜索 schema 与 entities facade**

`src/routes/-search.ts`（TanStack 约定：`-` 前缀文件不生成路由）：
```ts
import { z } from "zod";

/** 与后端 contract 的 jobListQuerySchema 同步；只用于 validateSearch */
export const jobListSearchSchema = z.object({
  category: z.coerce.number().pipe(z.union([z.literal(1), z.literal(2), z.literal(3)])).optional(),
  city: z.string().trim().min(1).optional(),
  q: z.string().trim().min(1).optional(),
  sort: z.enum(["deadline", "posted"]).default("deadline"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
```
`src/routes/index.tsx`：`import { jobListSearchSchema } from "./-search";`，`validateSearch: jobListSearchSchema`。

`src/entities/job/model/category.ts`：
```ts
import type { CategoryId } from "@api/types";

export const CATEGORY: Record<CategoryId, string> = { 1: "秋招与实习", 2: "央国企", 3: "外企" };

export const CATEGORY_OPTIONS = [
  { value: "all", label: "全部" },
  { value: "1", label: CATEGORY[1] },
  { value: "2", label: CATEGORY[2] },
  { value: "3", label: CATEGORY[3] },
] as const;

export function isCategoryId(n: number): n is CategoryId {
  return n === 1 || n === 2 || n === 3;
}
```

`src/entities/job/index.ts`：
```ts
export type { ApplicationStatus, CategoryId, JobListItem, JobListQuery, JobListResult, JobProgress } from "@api/types";
export { CATEGORY, CATEGORY_OPTIONS, isCategoryId } from "./model/category";
export { isExpired, statusLabel, statusVariant } from "./model/ui";
```
`src/entities/job/model/ui.ts`：导入改为 `from "@api/types"`。
`src/entities/quiz/index.ts`：`from "@job-hunt/shared"` → `from "@api/types"`。
`src/views/job-board/JobBoardPage.tsx`：`from "@job-hunt/shared"` → `from "@entities/job"`（该文件只用类型 `CategoryId, JobListItem, JobListQuery`）。

- [ ] **Step 8: 门禁**

```bash
grep -rn "@job-hunt/" src; pnpm typecheck && pnpm exec biome format --write src >/dev/null && pnpm exec biome check . && pnpm test
```
Expected：grep 无输出；typecheck、biome 清零；5 tests pass。

- [ ] **Step 9: 浏览器验收（后端在 `job_hunt_back` 起）**

```bash
(cd /Users/black/Desktop/job_hunt_back && pnpm dev > /tmp/back-dev.log 2>&1 &) ; (pnpm dev > /tmp/web-dev.log 2>&1 &) ; sleep 6
curl -s "localhost:5173/api/jobs?pageSize=1" | head -c 200; echo
```
浏览器过：看板（筛选进 URL、翻页、收藏/投递即时+刷新保留、进度卡片更新、排序默认值不进 URL）和刷题（答题解析、下一题、错题掌握、题集计数）。结束后 `pkill -f "tsx watch src/index.ts"; pkill -f vite`。截图放报告。

- [ ] **Step 10: 提交（在 `job_hunt_front`）**

```bash
git add -A && git commit -m "feat(web): api 层改 openapi-fetch，类型由后端 openapi.json 生成，去掉 workspace 类型依赖"
```

---

### Task 5: 前端目录提升到根、删除 workspace、文档、验收

**Files（前端仓库）:**
- Move: `apps/web/{index.html,vite.config.ts,tsconfig.json,package.json,public,src}` → 根
- Delete: `apps/`、`packages/`、`pnpm-workspace.yaml`、`tsconfig.base.json`、根旧 `package.json` 的 workspace 脚本
- Modify: `package.json`、`tsconfig.json`、`biome.json`、`.gitignore`、`README.md`、`AGENTS.md`、`.env.example`（改为 `VITE_API_PROXY` 示例）

- [ ] **Step 1: 搬家（在 `job_hunt_front` 根）**

```bash
git rm -rq apps/api packages pnpm-workspace.yaml tsconfig.base.json
git mv apps/web/index.html index.html && git mv apps/web/vite.config.ts vite.config.ts && git mv apps/web/public public && git mv apps/web/src src
git mv -f apps/web/tsconfig.json tsconfig.json && git mv -f apps/web/package.json package.json
rm -rf apps && ls
```

- [ ] **Step 2: 配置合并**

`package.json`（整体替换）：
```json
{
  "name": "job-hunt-front",
  "version": "0.3.0",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@12.4.1",
  "engines": { "node": ">=22" },
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit",
    "lint": "biome check .",
    "format": "biome format --write .",
    "test": "vitest run",
    "gen:api": "pnpm dlx openapi-typescript@7 \"${OPENAPI_SOURCE:-http://localhost:3001/api/openapi.json}\" -o src/api/schema.d.ts"
  },
  "dependencies": {
    "@tanstack/react-query": "^5.102.8",
    "@tanstack/react-router": "^1.170.35",
    "openapi-fetch": "^0.17.0",
    "react": "19.2.8",
    "react-dom": "19.2.8",
    "zod": "^4.5.4"
  },
  "devDependencies": {
    "@biomejs/biome": "2.5.13",
    "@tailwindcss/vite": "^4",
    "@tanstack/react-query-devtools": "^5.102.8",
    "@tanstack/react-router-devtools": "^1.167.1",
    "@tanstack/router-plugin": "^1.168.37",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "@vitejs/plugin-react": "^6.1.1",
    "hono": "^4.13.0",
    "tailwindcss": "^4",
    "typescript": "7.0.2",
    "vite": "^8.3.0",
    "vitest": "^5.0.0"
  }
}
```

`tsconfig.json`（整体替换，内联原 base）：
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "types": ["vite/client"],
    "strict": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "noEmit": true,
    "forceConsistentCasingInFileNames": true,
    "paths": {
      "@shared/*": ["./src/shared/*"],
      "@entities/*": ["./src/entities/*"],
      "@features/*": ["./src/features/*"],
      "@widgets/*": ["./src/widgets/*"],
      "@views/*": ["./src/views/*"],
      "@api/*": ["./src/api/*"]
    }
  },
  "include": ["src", "vite.config.ts"]
}
```

`.gitignore`（整体替换）：
```
node_modules/
.DS_Store
*.log
*.tsbuildinfo
.env*
!.env.example
dist/
.superpowers/
```
`.env.example`（整体替换）：
```
# 后端地址（Vite 开发代理目标）；后端在别的机器时改成它的 IP
VITE_API_PROXY=http://localhost:3001
```
`vite.config.ts` 里 `loadEnv(mode, process.cwd(), "VITE_")` 保持；`.env.local` 仍可覆盖。`biome.json` 的 `files.includes` 去掉 `!**/generated`（保留其余）；加 `"!src/api/schema.d.ts"`。

- [ ] **Step 3: `AGENTS.md`（整体替换）**

```markdown
# 项目约定（前端）

React 19 + Vite 8 + TanStack Router / Query + Tailwind v4，TypeScript 7，pnpm，Node 22。后端在独立仓库 `Blake-kuro/job_hunt_back`。

- 命令前 `source ~/.nvm/nvm.sh && nvm use`；用 pnpm。
- 接口类型来自 `src/api/schema.d.ts`（由后端 `openapi.json` 生成，提交在仓库里）。后端接口变了：`OPENAPI_SOURCE=<url 或 openapi.json 路径> pnpm gen:api`，然后一起提交。不要手改 `schema.d.ts`。
- 调用后端只经 `src/api/client.ts` 的 `client` + `unwrap`；DTO 类型从 `@api/types` 取。
- 本地开发 `.env.local` 里 `VITE_API_PROXY` 指向后端；不需要 CORS。
- 提交前 `pnpm typecheck && pnpm lint && pnpm test`。
- 不要启动或停止 3000 端口上的东西；验证用 5173，只停自己起的进程。
```

- [ ] **Step 4: `README.md`（整体替换）**

```markdown
# 职寻 · 校园招聘岗位看板（前端）

React 19 + Vite + TanStack Router / Query + Tailwind v4。后端：[job_hunt_back](https://github.com/Blake-kuro/job_hunt_back)。

## 启动

```bash
nvm use && corepack enable pnpm && pnpm install
cp .env.example .env.local     # VITE_API_PROXY 指向后端（默认本机 3001）
pnpm dev                       # http://localhost:5173
```

后端启动方式见其仓库 README（Docker Postgres、迁移、种子、Excel 导入都在那边）。

## 接口类型

`src/api/schema.d.ts` 由后端的 OpenAPI 文档生成并提交。后端接口变化后：

```bash
OPENAPI_SOURCE=http://localhost:3001/api/openapi.json pnpm gen:api    # 或 ../job_hunt_back/openapi.json
```

## 命令

`pnpm typecheck` / `pnpm lint` / `pnpm test` / `pnpm build`
```

- [ ] **Step 5: 门禁与验收**

```bash
rm -rf node_modules pnpm-lock.yaml && pnpm install && pnpm typecheck && pnpm lint && pnpm test && pnpm build
OPENAPI_SOURCE=/Users/black/Desktop/job_hunt_back/openapi.json pnpm gen:api && git diff --exit-code -- src/api/schema.d.ts && echo "schema in sync"
git grep -n "@job-hunt/\|apps/web\|packages/shared" -- . ':!docs' ':!.superpowers'; echo "exit=$?"
```
Expected：全绿；`schema in sync`；grep 无输出且 `exit=1`。再按 Task 4 Step 9 起后端 + 前端过一遍浏览器验收。

- [ ] **Step 6: 提交、推送、PR**

```bash
git add -A && git commit -m "chore: 前端提升为独立项目，移除 workspace；README / AGENTS 更新" && git push -u origin feat/repo-split-openapi
```
PR 由控制者创建（用户确认后）。
