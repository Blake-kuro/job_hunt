# 前后端分离重构（Monorepo）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 Next.js 单体拆成 pnpm monorepo：`apps/api`（Hono + Prisma）、`apps/web`（React 19 + Vite + TanStack Router/Query）、`packages/shared`（zod + DTO），并在新架构里完成刷题模块。

**Architecture:** shared 包以 TS 源码导出 zod schema 与 DTO；api 用 Hono 链式路由并导出 `AppType`；web 用 `hc<AppType>` 得到端到端类型，TanStack Router 管 URL 状态、TanStack Query 管缓存与乐观更新。Vite dev 代理 `/api` → `:3001`。

**Tech Stack:** pnpm 12、TypeScript 7.0.2（`tsc`）、Hono 4.13、`@hono/node-server` 2、`@hono/zod-validator` 0.9、Prisma 7.10、Vite 8、`@vitejs/plugin-react` 6、`@tailwindcss/vite` 4、TanStack Router 1.170 / Query 5.102、Biome 2.5.13、vitest 5、zod 4。

**Spec:** `docs/superpowers/specs/2026-09-13-monorepo-split-design.md`（原 spec `docs/superpowers/specs/2026-09-12-backend-data-layer-design.md` 的 4.3 / 6.3 / 7 / 9.2 节仍是数据模型、quiz service、端点、种子的权威）

## Global Constraints

- 分支 `feat/monorepo-split`（已存在，spec 已提交在上面）。所有提交都带 `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>` 尾行。
- 每个 shell 命令前缀：`source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && `（Node 22 是 Prisma 7 / Vite 8 硬要求）。
- 包管理器 **pnpm**（`corepack enable pnpm`）；不要用 npm 装依赖；`pnpm-lock.yaml` 提交，`package-lock.json` 删除。
- 数据库：docker `docker compose up -d`，宿主端口 **5433**；`DATABASE_URL=postgresql://postgres:postgres@localhost:5433/job_hunt` 在根 `.env`（已存在，git-ignored）。**绝不**碰本机 5432 的原生 PostgreSQL。
- **不要启动或杀掉用户自己的 dev server（:3000）**；验证时 api 用 `:3001`、web 用 `:5173`，验证完杀掉自己起的进程。
- Prisma 7：`schema.prisma` 不写 `url`；generator `prisma-client` + `output = "../src/generated/prisma"`；客户端必须 `new PrismaClient({ adapter: new PrismaPg({ connectionString }) })`。
- 时区 `Asia/Shanghai`：日期边界只经 `apps/api/src/lib/dates.ts`；任何地方不得 `new Date().getDate()` 之类。
- **Hono 路由必须链式定义并直接导出**（`export const xRoutes = new Hono<Env>().get(...).put(...)`），否则 `AppType` 丢失端点类型。
- REST 错误统一 `{ error: { code: "VALIDATION" | "NOT_FOUND" | "INTERNAL", message, issues? } }`；200 / 204 / 400 / 404 / 500。
- categoryId：1=秋招与实习，2=央国企，3=外企。
- 不引入 SWR / React Query 以外的数据库、不做登录、不做 SSR、不加 CORS。
- 每个任务结束时，对**已存在**的包 `pnpm typecheck && pnpm lint && pnpm test` 必须全绿（api 集成测试需要 docker 起着；`DATABASE_URL` 缺失时这些测试自动 skip）。
- 前端 bundle 不得含后端运行时代码：web 只能 `import type` 来自 `@job-hunt/api`。
- `.env`、`apps/api/src/generated/`、`.superpowers/`、`node_modules/`、`apps/web/dist/` 永不提交。

---

## 文件结构（目标状态）

见 spec 第 3 节。每个任务的 **Files** 块列出该任务创建/移动/修改的文件。

---

### Task 1: Monorepo 骨架

**Files:**
- Create: `pnpm-workspace.yaml`, `tsconfig.base.json`, `biome.json`
- Create: `packages/shared/package.json`, `packages/shared/tsconfig.json`, `packages/shared/src/index.ts`
- Create: `apps/api/package.json`, `apps/api/tsconfig.json`
- Create: `apps/web/package.json`, `apps/web/tsconfig.json`
- Modify: `package.json`（根，整体替换）、`.gitignore`
- Delete: `package-lock.json`

**Interfaces:**
- Produces: 三个包名 `@job-hunt/shared` / `@job-hunt/api` / `@job-hunt/web`；根脚本 `dev/build/test/typecheck/lint/format/db:*`；`tsconfig.base.json` 供各包 `extends`。

- [ ] **Step 1: 启用 pnpm**

```bash
corepack enable pnpm && corepack prepare pnpm@12.4.1 --activate && pnpm --version
```
Expected: `12.4.1`

- [ ] **Step 2: 根 `package.json`（整体替换）**

```json
{
  "name": "job-hunt",
  "version": "0.2.0",
  "private": true,
  "packageManager": "pnpm@12.4.1",
  "engines": { "node": ">=22" },
  "scripts": {
    "dev": "pnpm -r --parallel --filter \"./apps/*\" dev",
    "build": "pnpm -r build",
    "test": "pnpm -r test",
    "typecheck": "pnpm -r typecheck",
    "lint": "biome check .",
    "format": "biome format --write .",
    "db:up": "docker compose up -d",
    "db:migrate": "pnpm --filter @job-hunt/api exec prisma migrate dev",
    "db:seed": "pnpm --filter @job-hunt/api exec prisma db seed",
    "db:import": "pnpm --filter @job-hunt/api import"
  },
  "devDependencies": {
    "@biomejs/biome": "2.5.13",
    "typescript": "7.0.2"
  }
}
```

- [ ] **Step 3: `pnpm-workspace.yaml`**

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

- [ ] **Step 4: `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "noEmit": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

- [ ] **Step 5: `biome.json`**

```json
{
  "$schema": "https://biomejs.dev/schemas/2.5.13/schema.json",
  "vcs": { "enabled": true, "clientKind": "git", "useIgnoreFile": true },
  "files": {
    "includes": ["**", "!**/generated", "!**/dist", "!**/routeTree.gen.ts", "!**/.superpowers", "!**/.next"]
  },
  "formatter": { "enabled": true, "indentStyle": "space", "indentWidth": 2, "lineWidth": 120 },
  "javascript": { "formatter": { "quoteStyle": "double", "trailingCommas": "all", "semicolons": "always" } },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "suspicious": { "noArrayIndexKey": "off" }
    }
  },
  "assist": { "actions": { "source": { "organizeImports": "off" } } }
}
```

- [ ] **Step 6: 三个包的 `package.json` 与 `tsconfig.json`**

`packages/shared/package.json`:
```json
{
  "name": "@job-hunt/shared",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "build": "tsc --noEmit"
  },
  "dependencies": { "zod": "^4.5.4" },
  "devDependencies": { "typescript": "7.0.2", "vitest": "^5.0.0" }
}
```

`packages/shared/tsconfig.json`:
```json
{ "extends": "../../tsconfig.base.json", "compilerOptions": { "lib": ["ES2023"] }, "include": ["src"] }
```

`packages/shared/src/index.ts`（占位，Task 2 填充）:
```ts
export {};
```

`apps/api/package.json`:
```json
{
  "name": "@job-hunt/api",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "exports": { ".": { "types": "./src/app.ts" } },
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "start": "tsx src/index.ts",
    "build": "tsc --noEmit",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "import": "tsx scripts/import-jobs.ts",
    "postinstall": "prisma generate"
  },
  "dependencies": {
    "@hono/node-server": "^2.1.1",
    "@hono/zod-validator": "^0.9.1",
    "@job-hunt/shared": "workspace:*",
    "@prisma/adapter-pg": "^7.10.0",
    "@prisma/client": "^7.10.0",
    "dotenv": "^17.4.2",
    "exceljs": "^4.4.0",
    "hono": "^4.13.0",
    "zod": "^4.5.4"
  },
  "devDependencies": {
    "@types/node": "^22",
    "prisma": "^7.10.0",
    "tsx": "^4.23.13",
    "typescript": "7.0.2",
    "vitest": "^5.0.0"
  }
}
```

`apps/api/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "lib": ["ES2023"], "types": ["node"] },
  "include": ["src", "prisma", "scripts", "prisma.config.ts", "vitest.config.ts"],
  "exclude": ["src/generated"]
}
```

`apps/web/package.json`:
```json
{
  "name": "@job-hunt/web",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit",
    "test": "echo \"web: no tests\""
  },
  "dependencies": {
    "@job-hunt/shared": "workspace:*",
    "@tanstack/react-query": "^5.102.8",
    "@tanstack/react-router": "^1.170.35",
    "hono": "^4.13.0",
    "react": "19.2.8",
    "react-dom": "19.2.8",
    "zod": "^4.5.4"
  },
  "devDependencies": {
    "@job-hunt/api": "workspace:*",
    "@tailwindcss/vite": "^4",
    "@tanstack/react-query-devtools": "^5.102.8",
    "@tanstack/react-router-devtools": "^1.170.35",
    "@tanstack/router-plugin": "^1.168.37",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "@vitejs/plugin-react": "^6.1.1",
    "tailwindcss": "^4",
    "typescript": "7.0.2",
    "vite": "^8.3.0"
  }
}
```
（web 依赖 `hono` 只为 `hono/client` 的 `hc`，它是纯客户端代码。）

`apps/web/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "types": ["vite/client"],
    "baseUrl": ".",
    "paths": {
      "@shared/*": ["src/shared/*"],
      "@entities/*": ["src/entities/*"],
      "@features/*": ["src/features/*"],
      "@widgets/*": ["src/widgets/*"],
      "@views/*": ["src/views/*"],
      "@api/*": ["src/api/*"]
    }
  },
  "include": ["src", "vite.config.ts"]
}
```

- [ ] **Step 7: `.gitignore`（整体替换）**

```
node_modules/
.pnp
.pnp.*
.DS_Store
*.pem
*.log
*.tsbuildinfo

# env
.env*
!.env.example

# build output
apps/web/dist/
.next/

# prisma generated client
apps/api/src/generated/
src/generated/

# superpowers scratch
.superpowers/
```

- [ ] **Step 8: 删除 npm lockfile，安装**

```bash
rm -f package-lock.json && rm -rf node_modules && pnpm install
```
Expected: 安装成功。`apps/api` 的 `postinstall: prisma generate` 此时会失败（schema 还在根目录）——这是预期的：临时用 `pnpm install --ignore-scripts`，在报告里注明；Task 3 搬完 prisma 后 `pnpm install` 必须不带 `--ignore-scripts` 成功。

- [ ] **Step 9: 验证 lint 与 typecheck 能跑**

```bash
pnpm lint; pnpm --filter @job-hunt/shared typecheck
```
Expected: `biome check .` 会对旧 `src/` 报一批格式/lint 问题——**本任务不修旧代码**（它们在后续任务里被 `git mv` 后再修）。本任务只要求 biome 能启动、shared 包 typecheck 通过。把 biome 的错误计数写进报告。

- [ ] **Step 10: 提交**

```bash
git add -A && git commit -m "chore: pnpm monorepo 骨架（shared / api / web 三个包，biome，TS 7）"
```

---

### Task 2: `packages/shared` —— job / quiz 的 schema 与 DTO

**Files:**
- Create: `packages/shared/src/index.ts`（替换占位）、`packages/shared/src/http.ts`
- Create: `packages/shared/src/job/category.ts`、`packages/shared/src/job/query.ts`、`packages/shared/src/job/types.ts`、`packages/shared/src/job/query.test.ts`
- Create: `packages/shared/src/quiz/schema.ts`、`packages/shared/src/quiz/types.ts`、`packages/shared/src/quiz/schema.test.ts`

**Interfaces:**
- Consumes: 现有 `src/entities/job/model/{category,query,types}.ts` 的内容（复制，不 git mv，因为 web 侧还要保留 facade）。
- Produces: 导出 `CategoryId, CATEGORY, CATEGORY_OPTIONS, isCategoryId, jobListQuerySchema, JobListQuery, ApplicationStatus, JobListItem, JobListResult, JobProgress, ApiErrorBody, quizOptionLetterSchema, QuizOptionLetter, quizOptionSchema, quizOptionsSchema, QuizOption, submitAttemptSchema, SubmitAttemptInput, setMasteredSchema, QuizQuestionPublic, QuizToday, QuizAnswerResult, WrongBookItem, QuizDashboard, CompanySetItem`。

- [ ] **Step 1: job 三个文件**

`packages/shared/src/job/category.ts`：内容与现有 `src/entities/job/model/category.ts` 完全一致（`cat` 它然后复制）。

`packages/shared/src/job/query.ts`：
```ts
import { z } from "zod";

export const jobListQuerySchema = z.object({
  category: z.coerce.number().pipe(z.union([z.literal(1), z.literal(2), z.literal(3)])).optional(),
  city: z.string().trim().min(1).optional(),
  q: z.string().trim().min(1).optional(),
  sort: z.enum(["deadline", "posted"]).default("deadline"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type JobListQuery = z.infer<typeof jobListQuerySchema>;
```
（去掉了 `parseJobListQuery`。）

`packages/shared/src/job/types.ts`：现有 `src/entities/job/model/types.ts` 中 `ApplicationStatus / JobListItem / JobListResult / JobProgress` 四个类型，**不含**三个函数。

- [ ] **Step 2: 失败测试 `packages/shared/src/job/query.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { jobListQuerySchema } from "./query";

describe("jobListQuerySchema", () => {
  it("空对象得到默认值", () => {
    expect(jobListQuerySchema.parse({})).toEqual({ sort: "deadline", page: 1, pageSize: 20 });
  });
  it("字符串数字被 coerce", () => {
    expect(jobListQuerySchema.parse({ category: "2", page: "3" })).toMatchObject({ category: 2, page: 3 });
  });
  it("非法 category 报错", () => {
    expect(jobListQuerySchema.safeParse({ category: "9" }).success).toBe(false);
  });
  it("空白 q 视为非法（调用方应省略）", () => {
    expect(jobListQuerySchema.safeParse({ q: "  " }).success).toBe(false);
  });
});
```

- [ ] **Step 3: `packages/shared/src/http.ts`**

```ts
export type ApiErrorCode = "VALIDATION" | "NOT_FOUND" | "INTERNAL";

export interface ApiErrorBody {
  error: { code: ApiErrorCode; message: string; issues?: unknown[] };
}
```

- [ ] **Step 4: quiz schema 与类型**

`packages/shared/src/quiz/schema.ts`：
```ts
import { z } from "zod";

export const quizOptionLetterSchema = z.enum(["A", "B", "C", "D"]);
export type QuizOptionLetter = z.infer<typeof quizOptionLetterSchema>;

export const quizOptionSchema = z.object({ letter: quizOptionLetterSchema, text: z.string().min(1) });
export type QuizOption = z.infer<typeof quizOptionSchema>;

/** Question.options（Json 列）的形状：固定 4 项 */
export const quizOptionsSchema = z.array(quizOptionSchema).length(4);

export const submitAttemptSchema = z.object({
  questionId: z.string().min(1),
  picked: quizOptionLetterSchema,
});
export type SubmitAttemptInput = z.infer<typeof submitAttemptSchema>;

export const setMasteredSchema = z.object({ mastered: z.boolean() });
```

`packages/shared/src/quiz/types.ts`：
```ts
import type { QuizOption, QuizOptionLetter } from "./schema";

/** 发给前端的题目：不含答案与解析 */
export interface QuizQuestionPublic {
  id: string;
  prompt: string;
  options: QuizOption[];
  category: string;
  difficulty: string;
  source: string;
}

export interface QuizToday {
  question: QuizQuestionPublic | null;
  indexLabel: string;
  attemptedToday: number;
  date: string; // YYYY-MM-DD
}

export interface QuizAnswerResult {
  correct: boolean;
  answer: QuizOptionLetter;
  explanation: string[];
  accuracyRate: number | null;
}

export interface WrongBookItem {
  questionId: string;
  title: string;
  due: string;
}

export type WeekLabel = "一" | "二" | "三" | "四" | "五" | "六" | "日";

export interface QuizDashboard {
  streakDays: number;
  week: { label: WeekLabel; done: boolean }[];
  weekSolved: number;
  weekTarget: number;
  totalSolved: number;
  categories: { id: string; label: string; count: number }[];
  wrongList: WrongBookItem[];
}

export interface CompanySetItem {
  id: string;
  company: string;
  track: string;
  focus: string;
  count: number;
}
```

- [ ] **Step 5: 失败测试 `packages/shared/src/quiz/schema.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { quizOptionsSchema, submitAttemptSchema } from "./schema";

const four = ["A", "B", "C", "D"].map((letter) => ({ letter, text: `选项 ${letter}` }));

describe("quiz schemas", () => {
  it("options 必须恰好 4 项", () => {
    expect(quizOptionsSchema.safeParse(four).success).toBe(true);
    expect(quizOptionsSchema.safeParse(four.slice(0, 3)).success).toBe(false);
  });
  it("picked 只接受 A-D", () => {
    expect(submitAttemptSchema.safeParse({ questionId: "q-001", picked: "E" }).success).toBe(false);
    expect(submitAttemptSchema.parse({ questionId: "q-001", picked: "B" })).toEqual({ questionId: "q-001", picked: "B" });
  });
});
```

- [ ] **Step 6: `packages/shared/src/index.ts`**

```ts
export type { CategoryId } from "./job/category";
export { CATEGORY, CATEGORY_OPTIONS, isCategoryId } from "./job/category";
export type { JobListQuery } from "./job/query";
export { jobListQuerySchema } from "./job/query";
export type { ApplicationStatus, JobListItem, JobListResult, JobProgress } from "./job/types";
export type { ApiErrorBody, ApiErrorCode } from "./http";
export type { QuizOption, QuizOptionLetter, SubmitAttemptInput } from "./quiz/schema";
export {
  quizOptionLetterSchema,
  quizOptionSchema,
  quizOptionsSchema,
  setMasteredSchema,
  submitAttemptSchema,
} from "./quiz/schema";
export type {
  CompanySetItem,
  QuizAnswerResult,
  QuizDashboard,
  QuizQuestionPublic,
  QuizToday,
  WeekLabel,
  WrongBookItem,
} from "./quiz/types";
```

- [ ] **Step 7: 跑测试与门禁**

```bash
pnpm --filter @job-hunt/shared test && pnpm --filter @job-hunt/shared typecheck && pnpm exec biome check packages
```
Expected: 6 tests pass；typecheck / biome 无错。

- [ ] **Step 8: 提交**

```bash
git add packages && git commit -m "feat(shared): job / quiz 的 zod schema 与 DTO 类型"
```

---

### Task 3: `apps/api` 数据层搬迁（Prisma、lib、services、脚本）

**Files:**
- Move (`git mv`): `prisma/` → `apps/api/prisma/`；`prisma.config.ts` → `apps/api/prisma.config.ts`；`scripts/import-jobs.ts` → `apps/api/scripts/import-jobs.ts`；`src/server/db.ts` → `apps/api/src/db.ts`；`src/server/auth.ts` → `apps/api/src/auth.ts`；`src/server/lib/{dates,parse,job-dto,job-row}.ts` 及四个 `.test.ts` → `apps/api/src/lib/`；`src/server/services/{jobs,users}.ts` → `apps/api/src/services/`
- Create: `apps/api/src/env.ts`、`apps/api/src/load-env.ts`、`apps/api/src/lib/errors.ts`、`apps/api/vitest.config.ts`
- Delete: `src/server/lib/http.ts`、`vitest.config.ts`（根）
- Modify: 上述搬过来的每个文件的 import 路径

**Interfaces:**
- Consumes: `@job-hunt/shared` 的 job 类型与 `CATEGORY / isCategoryId`。
- Produces: `prisma`（`src/db.ts`）、`getCurrentUserId()` + `requestUser`（`src/auth.ts`）、`NotFoundError / validationHook / errorHandler`（`src/lib/errors.ts`）、`listJobs / setFavorite / setApplication / getProgress`（`services/jobs.ts`，签名不变）、`getCurrentUser(userId)`（`services/users.ts`，**改为接收 userId**）。

- [ ] **Step 1: git mv**

```bash
mkdir -p apps/api/src/lib apps/api/src/services
git mv prisma apps/api/prisma
git mv prisma.config.ts apps/api/prisma.config.ts
git mv scripts/import-jobs.ts apps/api/scripts/import-jobs.ts
git mv src/server/db.ts apps/api/src/db.ts
git mv src/server/auth.ts apps/api/src/auth.ts
for f in dates parse job-dto job-row; do git mv src/server/lib/$f.ts apps/api/src/lib/$f.ts; git mv src/server/lib/$f.test.ts apps/api/src/lib/$f.test.ts; done
git mv src/server/services/jobs.ts apps/api/src/services/jobs.ts
git mv src/server/services/users.ts apps/api/src/services/users.ts
git rm -q src/server/lib/http.ts vitest.config.ts
rmdir scripts 2>/dev/null; true
```

- [ ] **Step 2: 环境加载与 Env 类型**

`apps/api/src/load-env.ts`：
```ts
import { config } from "dotenv";
import { fileURLToPath } from "node:url";

// 根目录 .env（apps/api/src → 上三级）
config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });
```

`apps/api/src/env.ts`：
```ts
/** Hono 泛型：中间件注入的每请求变量 */
export type Env = { Variables: { userId: string } };
```

`apps/api/prisma.config.ts`（整体替换）：
```ts
import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { defineConfig, env } from "prisma/config";

config({ path: fileURLToPath(new URL("../../.env", import.meta.url)) });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
```

- [ ] **Step 3: 改 import 路径**

`apps/api/src/db.ts`：`import { PrismaClient } from "./generated/prisma/client";`（其余不变）。

`apps/api/src/auth.ts`（整体替换）：
```ts
import { createMiddleware } from "hono/factory";
import { prisma } from "./db";
import type { Env } from "./env";

export const DEV_USER_EMAIL = "dev@local";

/** 当前用户 id。现在固定返回种子开发账号；接入登录时只改 requestUser。 */
export async function getCurrentUserId(): Promise<string> {
  const user = await prisma.user.findUnique({ where: { email: DEV_USER_EMAIL }, select: { id: true } });
  if (!user) throw new Error(`种子用户 ${DEV_USER_EMAIL} 不存在，先运行 pnpm db:seed`);
  return user.id;
}

/** 每请求把 userId 放进 c.var */
export const requestUser = createMiddleware<Env>(async (c, next) => {
  c.set("userId", await getCurrentUserId());
  await next();
});
```

`apps/api/src/lib/errors.ts`：
```ts
import type { Hook } from "@hono/zod-validator";
import type { ErrorHandler } from "hono";
import type { Env } from "../env";

export class NotFoundError extends Error {
  constructor(message = "not found") {
    super(message);
    this.name = "NotFoundError";
  }
}

/** zValidator 第三参：校验失败统一 400 */
// biome-ignore lint/suspicious/noExplicitAny: 通用 hook，对任意 schema / 路由生效
export const validationHook: Hook<any, any, any> = (result, c) => {
  if (!result.success) {
    return c.json({ error: { code: "VALIDATION", message: "参数校验失败", issues: result.error.issues } }, 400);
  }
};

export const errorHandler: ErrorHandler<Env> = (err, c) => {
  if (err instanceof NotFoundError) {
    return c.json({ error: { code: "NOT_FOUND", message: err.message } }, 404);
  }
  console.error(err);
  return c.json({ error: { code: "INTERNAL", message: "服务器内部错误" } }, 500);
};
```
若 `Hook<any, any, any>` 与 zValidator 的期望类型不兼容（TS 报错），改为在每个 `zValidator(...)` 调用处内联同样的箭头函数，并在报告里写明。

`apps/api/src/lib/job-dto.ts`：
```ts
import { CATEGORY, isCategoryId, type JobListItem } from "@job-hunt/shared";
import type { Job } from "../generated/prisma/client";
import type { AppStatus } from "../generated/prisma/enums";
```
其余不变。`job-row.ts` 里 `@entities/job` → `@job-hunt/shared`，`./dates` / `./parse` 相对路径不变。

`apps/api/src/services/jobs.ts` 头部替换为：
```ts
import type { JobListQuery, JobListResult, JobProgress } from "@job-hunt/shared";
import { prisma } from "../db";
import type { Prisma } from "../generated/prisma/client";
import type { AppStatus } from "../generated/prisma/enums";
import { dateKey, daysBetween, dbDateToKey, keyToDate, keyToInstant, weekStartKey } from "../lib/dates";
import { NotFoundError } from "../lib/errors";
import { toJobListItem } from "../lib/job-dto";
```
（删除 `import "server-only"`；函数体不变。）

`apps/api/src/services/users.ts`（整体替换）：
```ts
import { prisma } from "../db";

export async function getCurrentUser(userId: string): Promise<{ id: string; email: string; name: string }> {
  return prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { id: true, email: true, name: true } });
}
```

`apps/api/prisma/seed.ts`：第一行 `import "dotenv/config";` → `import "../src/load-env";`，`import { prisma } from "../src/server/db";` → `import { prisma } from "../src/db";`。

`apps/api/scripts/import-jobs.ts`：`import "dotenv/config";` → `import "../src/load-env";`；`../src/server/db` → `../src/db`；`../src/server/lib/dates` → `../src/lib/dates`；`../src/server/lib/job-row` → `../src/lib/job-row`。

测试文件里若有 `@/...` 或 `@entities/job` 导入，改成相对路径 / `@job-hunt/shared`。

- [ ] **Step 4: `apps/api/vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    setupFiles: ["src/test/setup.ts"],
    fileParallelism: false,
  },
});
```

`apps/api/src/test/setup.ts`：
```ts
import "../load-env";
```

- [ ] **Step 5: 安装、生成、验证**

```bash
pnpm install && ls apps/api/src/generated/prisma/client.ts
pnpm --filter @job-hunt/api exec prisma migrate status
pnpm --filter @job-hunt/api test
pnpm --filter @job-hunt/api typecheck
pnpm exec biome check apps/api packages
```
Expected：`postinstall` 生成成功；`migrate status` 报 "Database schema is up to date"（docker 已起）；**37 tests pass**；typecheck 无错（此时 `scripts/import-jobs.ts`、`seed.ts` 也在 include 里，一并检查）；biome：对搬过来的文件按 `pnpm exec biome check --write apps/api` 自动修格式，剩余 lint 错误手工修（只改写法不改逻辑），全部清零。

- [ ] **Step 6: 种子与导入冒烟**

```bash
pnpm db:seed
pnpm db:import -- .superpowers/sdd/2026-09-12-backend-data-layer/jobs-fixture.xlsx
```
Expected：种子输出 `用户 dev@local 就绪`；导入脚本每个工作表打印 created/updated（fixture 若已导入过则 created=0）。若 fixture 文件不存在，跳过第二条并在报告注明。

- [ ] **Step 7: 提交**

```bash
git add -A && git commit -m "refactor(api): Prisma / lib / services / 脚本搬入 apps/api，去掉 server-only 与 Next 依赖"
```

---

### Task 4: `apps/api` HTTP 层 —— app、me / jobs 路由、集成测试

**Files:**
- Create: `apps/api/src/app.ts`、`apps/api/src/index.ts`、`apps/api/src/routes/me.ts`、`apps/api/src/routes/jobs.ts`
- Create: `apps/api/src/test/db.ts`、`apps/api/src/routes/me.test.ts`、`apps/api/src/routes/jobs.test.ts`
- Modify: `apps/api/src/app.ts` 先只挂 me / jobs（quiz 在 Task 5 加）

**Interfaces:**
- Consumes: Task 3 的 services、`requestUser`、`validationHook`、`errorHandler`、`jobListQuerySchema`。
- Produces: `export default app`、`export type AppType`；端点 `GET /api/me`、`GET /api/jobs`、`GET /api/jobs/progress`、`PUT|DELETE /api/jobs/:id/favorite`、`PUT|DELETE /api/jobs/:id/application`；测试工具 `resetDb / seedDevUser / insertJobs`。

- [ ] **Step 1: 测试工具 `apps/api/src/test/db.ts`**

```ts
import { DEV_USER_EMAIL } from "../auth";
import { prisma } from "../db";
import type { Prisma } from "../generated/prisma/client";

export const hasDb = Boolean(process.env.DATABASE_URL);

export async function resetDb() {
  await prisma.$executeRawUnsafe(
    'TRUNCATE "Attempt","WrongBookEntry","Question","CompanySet","QuestionCategory","Application","Favorite","Job","User" RESTART IDENTITY CASCADE',
  );
}

export async function seedDevUser() {
  return prisma.user.create({ data: { email: DEV_USER_EMAIL, name: "开发账号" } });
}

export async function insertJobs(rows: Prisma.JobCreateManyInput[]) {
  await prisma.job.createMany({ data: rows });
}

/** 三条固定岗位：id 1/2/3 分别属于分类 1/2/3 */
export function jobFixture(todayKey: string, addDays: (k: string, n: number) => string): Prisma.JobCreateManyInput[] {
  return [
    { id: 1, categoryId: 1, enterpriseName: "泡泡玛特", position: "产品经理、运营", workLocation: "北京、上海", recruitmentBatch: "2027 实习", deadline: addDays(todayKey, 5), deadlineAt: new Date(`${addDays(todayKey, 5)}T00:00:00Z`), createTime: new Date() },
    { id: 2, categoryId: 2, enterpriseName: "国家电网", position: "电气工程师", workLocation: "杭州", recruitmentBatch: "2027 秋招", deadline: addDays(todayKey, 20), deadlineAt: new Date(`${addDays(todayKey, 20)}T00:00:00Z`), createTime: new Date(Date.now() - 30 * 86_400_000) },
    { id: 3, categoryId: 3, enterpriseName: "丘钛集团", position: "算法工程师", workLocation: "深圳", recruitmentBatch: "2027 秋招", deadline: null, deadlineAt: null, createTime: new Date(Date.now() - 2 * 86_400_000) },
  ];
}
```

- [ ] **Step 2: 失败测试 `apps/api/src/routes/jobs.test.ts`**

```ts
import { beforeEach, describe, expect, it } from "vitest";
import app from "../app";
import { addDays, dateKey } from "../lib/dates";
import { hasDb, insertJobs, jobFixture, resetDb, seedDevUser } from "../test/db";

const json = (body: unknown) => ({
  method: "PUT",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

describe.skipIf(!hasDb)("/api/jobs", () => {
  beforeEach(async () => {
    await resetDb();
    await seedDevUser();
    await insertJobs(jobFixture(dateKey(), addDays));
  });

  it("GET 默认按截止日升序、null 在最后", async () => {
    const res = await app.request("/api/jobs");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(3);
    expect(body.items.map((j: { id: number }) => j.id)).toEqual([1, 2, 3]);
    expect(body.items[0]).toMatchObject({ company: "泡泡玛特", positions: ["产品经理", "运营"], cities: ["北京", "上海"], starred: false, applicationStatus: null });
  });

  it("GET category / city / q 筛选", async () => {
    expect((await (await app.request("/api/jobs?category=2")).json()).total).toBe(1);
    expect((await (await app.request("/api/jobs?city=深圳")).json()).total).toBe(1);
    expect((await (await app.request("/api/jobs?q=算法")).json()).items[0].id).toBe(3);
  });

  it("GET sort=posted 按发布时间倒序", async () => {
    const body = await (await app.request("/api/jobs?sort=posted")).json();
    expect(body.items.map((j: { id: number }) => j.id)).toEqual([1, 3, 2]);
  });

  it("GET 分页", async () => {
    const body = await (await app.request("/api/jobs?page=2&pageSize=2")).json();
    expect(body).toMatchObject({ page: 2, pageSize: 2, total: 3 });
    expect(body.items).toHaveLength(1);
  });

  it("GET 非法 category → 400 VALIDATION", async () => {
    const res = await app.request("/api/jobs?category=abc");
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: { code: "VALIDATION" } });
  });

  it("PUT/DELETE favorite 往返", async () => {
    expect(await (await app.request("/api/jobs/1/favorite", { method: "PUT" })).json()).toEqual({ starred: true });
    expect((await (await app.request("/api/jobs")).json()).items[0].starred).toBe(true);
    expect(await (await app.request("/api/jobs/1/favorite", { method: "DELETE" })).json()).toEqual({ starred: false });
  });

  it("PUT application 写状态，DELETE 清除", async () => {
    const put = await app.request("/api/jobs/2/application", json({ status: "APPLIED" }));
    expect(await put.json()).toEqual({ applicationStatus: "APPLIED" });
    const del = await app.request("/api/jobs/2/application", { method: "DELETE" });
    expect(await del.json()).toEqual({ applicationStatus: null });
  });

  it("PUT application 非法 status → 400；不存在的 id → 404", async () => {
    expect((await app.request("/api/jobs/2/application", json({ status: "NOPE" }))).status).toBe(400);
    const res = await app.request("/api/jobs/999/favorite", { method: "PUT" });
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: { code: "NOT_FOUND" } });
  });

  it("GET progress 反映收藏与投递", async () => {
    await app.request("/api/jobs/1/favorite", { method: "PUT" });
    await app.request("/api/jobs/2/application", json({ status: "APPLIED" }));
    const body = await (await app.request("/api/jobs/progress")).json();
    expect(body).toMatchObject({ starred: 1, applied: 1, interviewing: 0, nextDeadline: { jobId: 1, company: "泡泡玛特", daysLeft: 5 } });
  });
});
```

`apps/api/src/routes/me.test.ts`：
```ts
import { beforeEach, describe, expect, it } from "vitest";
import app from "../app";
import { hasDb, resetDb, seedDevUser } from "../test/db";

describe.skipIf(!hasDb)("/api/me", () => {
  beforeEach(async () => {
    await resetDb();
    await seedDevUser();
  });

  it("返回开发账号", async () => {
    const res = await app.request("/api/me");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ email: "dev@local", name: "开发账号" });
  });

  it("未知路径 → 404 JSON", async () => {
    const res = await app.request("/api/nope");
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: { code: "NOT_FOUND" } });
  });
});
```

- [ ] **Step 3: 跑测试确认失败**

```bash
pnpm --filter @job-hunt/api test
```
Expected: FAIL —— `Cannot find module '../app'`。

- [ ] **Step 4: 路由与 app**

`apps/api/src/routes/me.ts`：
```ts
import { Hono } from "hono";
import type { Env } from "../env";
import { getCurrentUser } from "../services/users";

export const meRoutes = new Hono<Env>().get("/", async (c) => c.json(await getCurrentUser(c.var.userId)));
```

`apps/api/src/routes/jobs.ts`：
```ts
import { zValidator } from "@hono/zod-validator";
import { jobListQuerySchema } from "@job-hunt/shared";
import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../env";
import { validationHook } from "../lib/errors";
import { getProgress, listJobs, setApplication, setFavorite } from "../services/jobs";

const idParam = z.object({ id: z.coerce.number().int().positive() });
const applicationBody = z.object({ status: z.enum(["APPLIED", "INTERVIEWING"]) });

export const jobRoutes = new Hono<Env>()
  .get("/", zValidator("query", jobListQuerySchema, validationHook), async (c) =>
    c.json(await listJobs(c.req.valid("query"), c.var.userId)),
  )
  .get("/progress", async (c) => c.json(await getProgress(c.var.userId)))
  .put("/:id/favorite", zValidator("param", idParam, validationHook), async (c) =>
    c.json(await setFavorite(c.req.valid("param").id, c.var.userId, true)),
  )
  .delete("/:id/favorite", zValidator("param", idParam, validationHook), async (c) =>
    c.json(await setFavorite(c.req.valid("param").id, c.var.userId, false)),
  )
  .put(
    "/:id/application",
    zValidator("param", idParam, validationHook),
    zValidator("json", applicationBody, validationHook),
    async (c) => c.json(await setApplication(c.req.valid("param").id, c.var.userId, c.req.valid("json").status)),
  )
  .delete("/:id/application", zValidator("param", idParam, validationHook), async (c) =>
    c.json(await setApplication(c.req.valid("param").id, c.var.userId, null)),
  );
```

`apps/api/src/app.ts`：
```ts
import { Hono } from "hono";
import { logger } from "hono/logger";
import { requestUser } from "./auth";
import type { Env } from "./env";
import { errorHandler } from "./lib/errors";
import { jobRoutes } from "./routes/jobs";
import { meRoutes } from "./routes/me";

const app = new Hono<Env>()
  .basePath("/api")
  .use(logger())
  .use(requestUser)
  .route("/me", meRoutes)
  .route("/jobs", jobRoutes)
  .notFound((c) => c.json({ error: { code: "NOT_FOUND", message: "接口不存在" } }, 404))
  .onError(errorHandler);

export default app;
export type AppType = typeof app;
```

`apps/api/src/index.ts`：
```ts
import "./load-env";
import { serve } from "@hono/node-server";
import app from "./app";

const port = Number(process.env.PORT ?? 3001);
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`api listening on http://localhost:${info.port}`);
});
```

测试里 `logger()` 会往 stdout 打每个请求；在 `app.ts` 里改为 `.use(process.env.NODE_ENV === "test" ? async (_c, next) => next() : logger())`，vitest 会自动设置 `NODE_ENV=test`。

- [ ] **Step 5: 跑测试**

```bash
pnpm --filter @job-hunt/api test && pnpm --filter @job-hunt/api typecheck && pnpm exec biome check apps/api
```
Expected: 37 + 11 = **48 tests pass**（若 DATABASE_URL 缺失则 11 个 skip——本环境必须是 pass 而非 skip）；typecheck、biome 清零。

- [ ] **Step 6: 手工冒烟（自起自杀）**

```bash
(pnpm --filter @job-hunt/api dev > /tmp/api-dev.log 2>&1 &) ; sleep 4
curl -s localhost:3001/api/me; echo
curl -s "localhost:3001/api/jobs?pageSize=1" | head -c 300; echo
curl -s -X PUT localhost:3001/api/jobs/999/favorite; echo
pkill -f "tsx watch src/index.ts"; true
```
Expected：三行分别是用户 JSON、岗位列表 JSON 片段、`{"error":{"code":"NOT_FOUND",...}}`。

- [ ] **Step 7: 提交**

```bash
git add -A && git commit -m "feat(api): Hono 应用与 me / jobs 路由，真库集成测试"
```

---

### Task 5: `apps/api` 刷题模块 —— service、路由、种子、测试

**Files:**
- Create: `apps/api/src/services/quiz.ts`、`apps/api/src/routes/quiz.ts`、`apps/api/src/routes/quiz.test.ts`、`apps/api/prisma/quiz-data.ts`
- Modify: `apps/api/src/app.ts`（挂 `/quiz`）、`apps/api/prisma/seed.ts`（追加 `seedQuiz`）

**Interfaces:**
- Consumes: shared 的 quiz schema/类型；`lib/dates.ts` 的 `dateKey / addDays / keyToInstant / weekStartKey / computeStreak / dueLabel`；`NotFoundError`。
- Produces: 端点 `GET /api/quiz/today`、`POST /api/quiz/attempts`、`GET /api/quiz/dashboard`、`GET /api/quiz/wrong-book`、`PUT /api/quiz/wrong-book/:questionId`、`GET /api/quiz/company-sets`；`seedQuiz()`。

- [ ] **Step 1: 种子数据 `apps/api/prisma/quiz-data.ts`**

```ts
import type { Difficulty } from "../src/generated/prisma/enums";

export const CATEGORIES = [
  { id: "cat-1", name: "言语理解与表达" },
  { id: "cat-2", name: "计算机基础单选" },
  { id: "cat-3", name: "算法概念选择题" },
  { id: "cat-4", name: "行为面情景选择" },
  { id: "cat-5", name: "公司真题合集" },
] as const;

export const COMPANY_SETS = [
  { id: "set-1", company: "阿里巴巴", track: "互联网 · 后端", focus: "JVM、MySQL 索引、分布式事务、场景设计题" },
  { id: "set-2", company: "腾讯", track: "互联网 · 客户端", focus: "C++ 内存模型、网络协议、操作系统调度" },
  { id: "set-3", company: "字节跳动", track: "互联网 · 全栈", focus: "算法中等偏难、浏览器渲染、系统设计" },
  { id: "set-4", company: "华为", track: "硬件 · 嵌入式", focus: "C 语言指针、RTOS、数字电路与通信基础" },
] as const;

export interface SeedQuestion {
  id: string;
  categoryId: string;
  companySetId?: string;
  prompt: string;
  options: [string, string, string, string]; // A B C D
  answer: "A" | "B" | "C" | "D";
  explanation: string[];
  difficulty: Difficulty;
  source: string;
}

const q = (
  id: string,
  categoryId: string,
  difficulty: Difficulty,
  source: string,
  prompt: string,
  options: [string, string, string, string],
  answer: SeedQuestion["answer"],
  explanation: string[],
  companySetId?: string,
): SeedQuestion => ({ id, categoryId, companySetId, prompt, options, answer, explanation, difficulty, source });

export const QUESTIONS: SeedQuestion[] = [
  q("q-001", "cat-1", "MEDIUM", "行测真题",
    "一百多年来，现代语言科学经历了三个重要时期，历史比较语言学、结构主义语言学和转换生成语言学分别是这三个时期的代表。对这段话最准确的复述是：",
    ["现代语言学发展了一百多年", "现代语言学经历了历史比较语言学、结构主义语言学和转换生成语言学三大时期", "历史比较语言学、结构主义语言学和转换生成语言学是现代语言学", "历史比较语言学、结构主义语言学和转换生成语言学都经历了一百多年的发展"],
    "B",
    ["材料的主干是「现代语言科学经历了三个重要时期」，后半句只是为三个时期各举一个代表。B 完整保留了主干与三者的对应关系。", "A 只取时间信息丢掉主干；C 把「代表」偷换为「就是」；D 把「一百多年」错分给三个时期。"]),
  q("q-002", "cat-1", "EASY", "行测真题",
    "下列句子中没有语病的一项是：",
    ["通过这次活动，使同学们增强了环保意识。", "他的写作水平比以前有了很大的提高。", "能否坚持锻炼，是身体健康的保证。", "我们要尽量避免不发生类似错误。"],
    "B",
    ["A「通过……使……」导致主语缺失；C「能否」两面对「保证」一面；D「避免不发生」否定不当，意思反了。"]),
  q("q-003", "cat-2", "EASY", "408 真题",
    "TCP 三次握手中，客户端在第二次握手收到的报文标志位是：",
    ["SYN", "ACK", "SYN + ACK", "FIN"],
    "C",
    ["第一次客户端发 SYN，第二次服务端回 SYN+ACK 同时确认并同步序号，第三次客户端发 ACK。"]),
  q("q-004", "cat-2", "MEDIUM", "408 真题",
    "下列关于进程与线程的说法，错误的是：",
    ["线程是 CPU 调度的基本单位", "同一进程内的线程共享地址空间", "进程切换的开销通常大于线程切换", "一个线程崩溃不会影响同一进程内的其他线程"],
    "D",
    ["同一进程内线程共享地址空间，一个线程的非法内存访问会让整个进程终止，其他线程随之消失，D 说反了。"]),
  q("q-005", "cat-3", "EASY", "算法基础",
    "快速排序的平均时间复杂度是：",
    ["O(n)", "O(n log n)", "O(n²)", "O(log n)"],
    "B",
    ["每层划分 O(n)，期望递归深度 O(log n)，平均 O(n log n)；最坏（每次都选到极值）退化为 O(n²)。"]),
  q("q-006", "cat-3", "MEDIUM", "算法基础",
    "在含 n 个结点的平衡二叉搜索树中查找一个元素，最坏情况时间复杂度是：",
    ["O(1)", "O(log n)", "O(n)", "O(n log n)"],
    "B",
    ["平衡树保证高度为 O(log n)，一次查找最多走一条根到叶的路径。O(n) 是普通 BST 退化成链表的情况。"]),
  q("q-007", "cat-4", "EASY", "面经整理",
    "小组作业中两位成员对方案分工产生冲突，作为组长最恰当的做法是：",
    ["直接指定分工，要求执行", "组织双方说明各自顾虑，按项目目标重新明确分工", "让两人自行协商，不介入", "把有争议的部分自己承担"],
    "B",
    ["组长的职责是让分歧回到目标上：先听清各自的顾虑，再按项目目标做决定。A 忽视顾虑，C 放任，D 回避问题。"]),
  q("q-008", "cat-4", "EASY", "面经整理",
    "实习中发现导师给的需求文档与线上实际行为不一致，最恰当的做法是：",
    ["按文档实现", "按线上行为实现", "记录差异并向导师确认以哪个为准后再动手", "两种都实现让导师选"],
    "C",
    ["差异本身就是信息，先确认再动手成本最低；A/B 各赌一半，D 浪费一倍工作量。"]),
  q("q-009", "cat-5", "MEDIUM", "阿里巴巴 · 面经",
    "MySQL InnoDB 中，下列哪种情况会发生回表查询：",
    ["通过聚簇索引查询", "查询列全部包含在二级索引中（覆盖索引）", "通过二级索引查询，且查询列不在该索引中", "通过主键索引查询"],
    "C",
    ["二级索引叶子只存主键值，查询列不在索引里就得再按主键去聚簇索引取整行，即回表；覆盖索引正是为了避免这一步。"], "set-1"),
  q("q-010", "cat-5", "EASY", "阿里巴巴 · 面经",
    "JVM 中，新创建的对象通常首先分配在：",
    ["老年代", "新生代 Eden 区", "方法区", "虚拟机栈"],
    "B",
    ["对象优先在 Eden 分配，Minor GC 后存活的进入 Survivor，多次存活后晋升老年代；大对象可能直接进老年代。"], "set-1"),
  q("q-011", "cat-5", "HARD", "阿里巴巴 · 面经",
    "分布式事务的两阶段提交（2PC），其主要缺点不包括：",
    ["协调者单点故障", "参与者在准备阶段后同步阻塞", "协调者与参与者同时宕机时可能数据不一致", "无法保证原子性"],
    "D",
    ["2PC 的目标正是原子提交，正常运行时能保证原子性；它的问题是阻塞、单点和极端故障下的不一致。"], "set-1"),
  q("q-012", "cat-5", "MEDIUM", "腾讯 · 面经",
    "C++ 中关于 std::unique_ptr 的说法，正确的是：",
    ["可以被拷贝构造", "只能通过 std::move 转移所有权", "内部使用引用计数", "不能用于管理数组"],
    "B",
    ["unique_ptr 独占所有权，拷贝构造被删除，只能移动；引用计数是 shared_ptr；unique_ptr<T[]> 可以管理数组。"], "set-2"),
  q("q-013", "cat-5", "EASY", "腾讯 · 面经",
    "HTTP/2 相比 HTTP/1.1 的改进不包括：",
    ["多路复用", "头部压缩（HPACK）", "改为基于 UDP 传输", "服务器推送"],
    "C",
    ["HTTP/2 仍基于 TCP；基于 UDP 的是 HTTP/3（QUIC）。"], "set-2"),
  q("q-014", "cat-5", "MEDIUM", "腾讯 · 面经",
    "下列调度算法中，可能导致某些作业长期得不到执行（饥饿）的是：",
    ["时间片轮转", "非抢占式最短作业优先", "先来先服务", "带老化机制的多级反馈队列"],
    "B",
    ["SJF 总是优先短作业，长作业在短作业源源不断时会一直等待；轮转和 FCFS 都保证每个作业最终执行，老化机制正是为了解决饥饿。"], "set-2"),
  q("q-015", "cat-5", "MEDIUM", "字节跳动 · 面经",
    "浏览器中，JavaScript 修改元素宽度后立即读取 offsetWidth，会触发：",
    ["仅重绘（repaint）", "强制同步布局（回流）", "仅合成层更新", "什么也不触发"],
    "B",
    ["读取布局属性会迫使浏览器立刻执行排队中的样式计算与布局，得到最新几何值，这就是强制同步布局。"], "set-3"),
  q("q-016", "cat-5", "EASY", "字节跳动 · 面经",
    "数组不变、多次查询任意区间和，最优的预处理方案是：",
    ["线段树", "前缀和", "每次查询遍历区间", "哈希表"],
    "B",
    ["无修改场景下前缀和 O(n) 预处理、O(1) 查询；线段树适合带修改的场景，代价更高。"], "set-3"),
  q("q-017", "cat-5", "HARD", "字节跳动 · 面经",
    "系统设计中，为热点 key 的读请求减压，最直接的手段是：",
    ["增加数据库分片", "本地缓存 + 分布式缓存的多级缓存", "提高数据库连接数", "把写改为同步"],
    "B",
    ["热点读的问题在于单个 key 打到同一节点，分片解决不了；多级缓存让绝大多数读在应用进程内命中。"], "set-3"),
  q("q-018", "cat-5", "MEDIUM", "华为 · 面经",
    "C 语言中，`int *p[4];` 声明的 p 是：",
    ["指向含 4 个 int 的数组的指针", "含 4 个 int 指针的数组", "指向 int 的指针", "返回 int 指针的函数"],
    "B",
    ["[] 优先级高于 *，先结合成数组 p[4]，元素类型为 int*。指向数组的指针要写成 int (*p)[4]。"], "set-4"),
  q("q-019", "cat-5", "MEDIUM", "华为 · 面经",
    "RTOS 中，优先级反转的典型解决方案是：",
    ["增大时间片", "优先级继承协议", "关闭所有中断", "改用轮询"],
    "B",
    ["低优先级任务持有高优先级任务需要的锁时，临时把它提升到高优先级，避免被中优先级任务抢占。"], "set-4"),
  q("q-020", "cat-5", "EASY", "华为 · 面经",
    "8 位二进制补码能表示的整数范围是：",
    ["-127 ~ 127", "-128 ~ 127", "0 ~ 255", "-128 ~ 128"],
    "B",
    ["补码只有一个 0，负数比正数多一个：-2^7 ~ 2^7 - 1。"], "set-4"),
];
```

- [ ] **Step 2: `seedQuiz` 追加到 `apps/api/prisma/seed.ts`**

```ts
import { CATEGORIES, COMPANY_SETS, QUESTIONS } from "./quiz-data";

const LETTERS = ["A", "B", "C", "D"] as const;

async function seedQuiz() {
  for (const c of CATEGORIES) {
    await prisma.questionCategory.upsert({ where: { id: c.id }, update: { name: c.name }, create: c });
  }
  for (const s of COMPANY_SETS) {
    await prisma.companySet.upsert({ where: { id: s.id }, update: { company: s.company, track: s.track, focus: s.focus }, create: s });
  }
  for (const item of QUESTIONS) {
    const data = {
      categoryId: item.categoryId,
      companySetId: item.companySetId ?? null,
      prompt: item.prompt,
      options: item.options.map((text, i) => ({ letter: LETTERS[i], text })),
      answer: item.answer,
      explanation: item.explanation,
      difficulty: item.difficulty,
      source: item.source,
    };
    await prisma.question.upsert({ where: { id: item.id }, update: data, create: { id: item.id, ...data } });
  }
  console.log(`题库就绪：${CATEGORIES.length} 个分类，${COMPANY_SETS.length} 个题集，${QUESTIONS.length} 道题`);
}
```
`main()` 改为 `await seedUser(); await seedQuiz();`。

- [ ] **Step 3: 失败测试 `apps/api/src/routes/quiz.test.ts`**

```ts
import { beforeEach, describe, expect, it } from "vitest";
import app from "../app";
import { prisma } from "../db";
import { hasDb, resetDb, seedDevUser } from "../test/db";

const LETTERS = ["A", "B", "C", "D"] as const;
const post = (body: unknown) => ({ method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const put = (body: unknown) => ({ method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

async function insertQuestions() {
  await prisma.questionCategory.create({ data: { id: "cat-1", name: "言语理解与表达" } });
  await prisma.companySet.create({ data: { id: "set-1", company: "阿里巴巴", track: "互联网 · 后端", focus: "JVM" } });
  for (const [i, answer] of (["B", "C"] as const).entries()) {
    await prisma.question.create({
      data: {
        id: `q-00${i + 1}`,
        categoryId: "cat-1",
        companySetId: i === 1 ? "set-1" : null,
        prompt: `第 ${i + 1} 题的题干，长度足够长以便测试截断到二十四个字的行为是否正确`,
        options: LETTERS.map((letter) => ({ letter, text: `选项 ${letter}` })),
        answer,
        explanation: ["解析一", "解析二"],
        difficulty: "MEDIUM",
        source: "测试",
      },
    });
  }
}

describe.skipIf(!hasDb)("/api/quiz", () => {
  beforeEach(async () => {
    await resetDb();
    await seedDevUser();
    await insertQuestions();
  });

  it("today 返回第一道未答题，不含答案", async () => {
    const body = await (await app.request("/api/quiz/today")).json();
    expect(body.question.id).toBe("q-001");
    expect(body.question).not.toHaveProperty("answer");
    expect(body.question.options).toHaveLength(4);
    expect(body).toMatchObject({ indexLabel: "试题 1 / 20", attemptedToday: 0 });
  });

  it("答错：写 Attempt、进错题本、today 换到下一题", async () => {
    const res = await app.request("/api/quiz/attempts", post({ questionId: "q-001", picked: "A" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ correct: false, answer: "B", explanation: ["解析一", "解析二"], accuracyRate: 0 });
    const wrong = await (await app.request("/api/quiz/wrong-book")).json();
    expect(wrong.items).toHaveLength(1);
    expect(wrong.items[0]).toMatchObject({ questionId: "q-001", due: "明天" });
    expect(wrong.items[0].title).toHaveLength(24);
    const today = await (await app.request("/api/quiz/today")).json();
    expect(today.question.id).toBe("q-002");
    expect(today.indexLabel).toBe("试题 2 / 20");
  });

  it("答对：不进错题本，正确率 100", async () => {
    const body = await (await app.request("/api/quiz/attempts", post({ questionId: "q-002", picked: "C" }))).json();
    expect(body).toMatchObject({ correct: true, accuracyRate: 100 });
    expect((await (await app.request("/api/quiz/wrong-book")).json()).items).toHaveLength(0);
  });

  it("attempts 校验：非法 picked → 400；不存在的题 → 404", async () => {
    expect((await app.request("/api/quiz/attempts", post({ questionId: "q-001", picked: "E" }))).status).toBe(400);
    expect((await app.request("/api/quiz/attempts", post({ questionId: "nope", picked: "A" }))).status).toBe(404);
  });

  it("dashboard：打卡、本周、分类、错题", async () => {
    await app.request("/api/quiz/attempts", post({ questionId: "q-001", picked: "A" }));
    const body = await (await app.request("/api/quiz/dashboard")).json();
    expect(body.streakDays).toBe(1);
    expect(body.week).toHaveLength(7);
    expect(body.week.filter((d: { done: boolean }) => d.done)).toHaveLength(1);
    expect(body).toMatchObject({ weekSolved: 1, weekTarget: 20, totalSolved: 1 });
    expect(body.categories).toEqual([{ id: "cat-1", label: "言语理解与表达", count: 2 }]);
    expect(body.wrongList).toHaveLength(1);
  });

  it("wrong-book PUT mastered → 204 且从列表消失；不存在 → 404", async () => {
    await app.request("/api/quiz/attempts", post({ questionId: "q-001", picked: "A" }));
    const res = await app.request("/api/quiz/wrong-book/q-001", put({ mastered: true }));
    expect(res.status).toBe(204);
    expect((await (await app.request("/api/quiz/wrong-book")).json()).items).toHaveLength(0);
    expect((await app.request("/api/quiz/wrong-book/q-002", put({ mastered: true }))).status).toBe(404);
  });

  it("company-sets 带题数", async () => {
    const body = await (await app.request("/api/quiz/company-sets")).json();
    expect(body.items).toEqual([{ id: "set-1", company: "阿里巴巴", track: "互联网 · 后端", focus: "JVM", count: 1 }]);
  });

  it("题库答完 today.question 为 null", async () => {
    await app.request("/api/quiz/attempts", post({ questionId: "q-001", picked: "B" }));
    await app.request("/api/quiz/attempts", post({ questionId: "q-002", picked: "C" }));
    const body = await (await app.request("/api/quiz/today")).json();
    expect(body.question).toBeNull();
    expect(body.attemptedToday).toBe(2);
  });
});
```

- [ ] **Step 4: 跑测试确认失败**

```bash
pnpm --filter @job-hunt/api test -- quiz
```
Expected: FAIL（404 —— `/quiz` 尚未挂载）。

- [ ] **Step 5: `apps/api/src/services/quiz.ts`**

```ts
import {
  type CompanySetItem,
  type QuizAnswerResult,
  type QuizDashboard,
  type QuizOptionLetter,
  type QuizToday,
  type WeekLabel,
  type WrongBookItem,
  quizOptionsSchema,
} from "@job-hunt/shared";
import { prisma } from "../db";
import { addDays, computeStreak, dateKey, dueLabel, keyToInstant, weekStartKey } from "../lib/dates";
import { NotFoundError } from "../lib/errors";

const DIFFICULTY_LABEL = { EASY: "难度 简单", MEDIUM: "难度 中等", HARD: "难度 困难" } as const;
const WEEK_LABELS: WeekLabel[] = ["一", "二", "三", "四", "五", "六", "日"];
const WEEK_TARGET = 20;

export async function getTodayQuestion(userId: string): Promise<QuizToday> {
  const today = dateKey();
  const [question, attemptedToday] = await Promise.all([
    prisma.question.findFirst({
      where: { attempts: { none: { userId } } },
      orderBy: { id: "asc" },
      include: { category: { select: { name: true } } },
    }),
    prisma.attempt.count({
      where: { userId, answeredAt: { gte: keyToInstant(today), lt: keyToInstant(addDays(today, 1)) } },
    }),
  ]);

  return {
    question: question
      ? {
          id: question.id,
          prompt: question.prompt,
          options: quizOptionsSchema.parse(question.options),
          category: question.category.name,
          difficulty: DIFFICULTY_LABEL[question.difficulty],
          source: question.source,
        }
      : null,
    indexLabel: `试题 ${attemptedToday + 1} / ${WEEK_TARGET}`,
    attemptedToday,
    date: today,
  };
}

export async function submitAnswer(userId: string, questionId: string, picked: QuizOptionLetter): Promise<QuizAnswerResult> {
  const q = await prisma.question.findUnique({ where: { id: questionId }, select: { answer: true, explanation: true } });
  if (!q) throw new NotFoundError(`题目 ${questionId} 不存在`);

  const correct = picked === q.answer;
  await prisma.$transaction(async (tx) => {
    await tx.attempt.create({ data: { userId, questionId, picked, correct } });
    if (!correct) {
      const nextReviewAt = keyToInstant(addDays(dateKey(), 1));
      await tx.wrongBookEntry.upsert({
        where: { userId_questionId: { userId, questionId } },
        update: { nextReviewAt, mastered: false },
        create: { userId, questionId, nextReviewAt },
      });
    }
  });

  const [total, right] = await Promise.all([
    prisma.attempt.count({ where: { questionId } }),
    prisma.attempt.count({ where: { questionId, correct: true } }),
  ]);

  return {
    correct,
    answer: q.answer as QuizOptionLetter,
    explanation: q.explanation,
    accuracyRate: total === 0 ? null : Math.round((right / total) * 100),
  };
}

export async function listWrongBook(userId: string): Promise<WrongBookItem[]> {
  const today = dateKey();
  const rows = await prisma.wrongBookEntry.findMany({
    where: { userId, mastered: false },
    orderBy: { nextReviewAt: "asc" },
    select: { questionId: true, nextReviewAt: true, question: { select: { prompt: true } } },
  });
  return rows.map((r) => ({
    questionId: r.questionId,
    title: r.question.prompt.slice(0, 24),
    due: dueLabel(r.nextReviewAt, today),
  }));
}

export async function getDashboard(userId: string): Promise<QuizDashboard> {
  const today = dateKey();
  const weekStart = weekStartKey(today);

  const [attempts, weekAttempts, allSolved, categories, wrongList] = await Promise.all([
    prisma.attempt.findMany({ where: { userId }, select: { answeredAt: true } }),
    prisma.attempt.findMany({
      where: { userId, answeredAt: { gte: keyToInstant(weekStart) } },
      select: { questionId: true },
      distinct: ["questionId"],
    }),
    prisma.attempt.findMany({ where: { userId }, select: { questionId: true }, distinct: ["questionId"] }),
    prisma.questionCategory.findMany({
      select: { id: true, name: true, _count: { select: { questions: true } } },
      orderBy: { id: "asc" },
    }),
    listWrongBook(userId),
  ]);

  const days = new Set(attempts.map((a) => dateKey(a.answeredAt)));
  return {
    streakDays: computeStreak(days, today),
    week: WEEK_LABELS.map((label, i) => ({ label, done: days.has(addDays(weekStart, i)) })),
    weekSolved: weekAttempts.length,
    weekTarget: WEEK_TARGET,
    totalSolved: allSolved.length,
    categories: categories.map((c) => ({ id: c.id, label: c.name, count: c._count.questions })),
    wrongList,
  };
}

export async function setMastered(userId: string, questionId: string, mastered: boolean): Promise<void> {
  const r = await prisma.wrongBookEntry.updateMany({ where: { userId, questionId }, data: { mastered } });
  if (r.count === 0) throw new NotFoundError(`错题本里没有题目 ${questionId}`);
}

export async function listCompanySets(): Promise<CompanySetItem[]> {
  const rows = await prisma.companySet.findMany({
    select: { id: true, company: true, track: true, focus: true, _count: { select: { questions: true } } },
    orderBy: { id: "asc" },
  });
  return rows.map((r) => ({ id: r.id, company: r.company, track: r.track, focus: r.focus, count: r._count.questions }));
}
```

- [ ] **Step 6: `apps/api/src/routes/quiz.ts` 并挂到 app**

```ts
import { zValidator } from "@hono/zod-validator";
import { setMasteredSchema, submitAttemptSchema } from "@job-hunt/shared";
import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../env";
import { validationHook } from "../lib/errors";
import { getDashboard, getTodayQuestion, listCompanySets, listWrongBook, setMastered, submitAnswer } from "../services/quiz";

const questionParam = z.object({ questionId: z.string().min(1) });

export const quizRoutes = new Hono<Env>()
  .get("/today", async (c) => c.json(await getTodayQuestion(c.var.userId)))
  .post("/attempts", zValidator("json", submitAttemptSchema, validationHook), async (c) => {
    const { questionId, picked } = c.req.valid("json");
    return c.json(await submitAnswer(c.var.userId, questionId, picked));
  })
  .get("/dashboard", async (c) => c.json(await getDashboard(c.var.userId)))
  .get("/wrong-book", async (c) => c.json({ items: await listWrongBook(c.var.userId) }))
  .put(
    "/wrong-book/:questionId",
    zValidator("param", questionParam, validationHook),
    zValidator("json", setMasteredSchema, validationHook),
    async (c) => {
      await setMastered(c.var.userId, c.req.valid("param").questionId, c.req.valid("json").mastered);
      return c.body(null, 204);
    },
  )
  .get("/company-sets", async (c) => c.json({ items: await listCompanySets() }));
```

`app.ts`：`import { quizRoutes } from "./routes/quiz";`，在 `.route("/jobs", jobRoutes)` 后加 `.route("/quiz", quizRoutes)`。

- [ ] **Step 7: 测试与种子**

```bash
pnpm --filter @job-hunt/api test && pnpm --filter @job-hunt/api typecheck && pnpm exec biome check apps/api
pnpm db:seed
```
Expected：48 + 8 = **56 tests pass**；seed 输出 `题库就绪：5 个分类，4 个题集，20 道题`；再跑一次 `pnpm db:seed` 仍成功（幂等）。

- [ ] **Step 8: 提交**

```bash
git add -A && git commit -m "feat(api): 刷题模块 —— quiz service / 路由 / 20 题种子，集成测试"
```

---

### Task 6: `apps/web` 骨架 —— Vite、Router、Query、RPC client、FSD 目录搬迁

**Files:**
- Move (`git mv`): `src/shared` → `apps/web/src/shared`；`src/entities` → `apps/web/src/entities`；`src/features` → `apps/web/src/features`；`src/widgets` → `apps/web/src/widgets`；`src/views` → `apps/web/src/views`；`src/shared/styles/tokens.css` → `apps/web/src/styles/tokens.css`；`src/app/favicon.ico` → `apps/web/public/favicon.ico`
- Create: `apps/web/index.html`、`apps/web/vite.config.ts`、`apps/web/src/main.tsx`、`apps/web/src/router.tsx`、`apps/web/src/routes/__root.tsx`、`apps/web/src/routes/index.tsx`、`apps/web/src/routes/practice.tsx`、`apps/web/src/styles/globals.css`、`apps/web/src/api/client.ts`、`apps/web/src/api/queries.ts`、`apps/web/src/shared/ui/ErrorPanel.tsx`
- Modify: `apps/web/src/entities/job/index.ts`（facade 指向 shared）、`apps/web/src/entities/job/model/ui.ts`（新，三个函数）、删除 `entities/job/model/{category,query,types}.ts`；`apps/web/src/widgets/navbar/Navbar.tsx`（`next/link` → Router `Link`）

**Interfaces:**
- Consumes: `AppType`（类型）、shared 的 schema/类型。
- Produces: `api`（`hc` 客户端）、`ApiError`、`unwrap`、`jobsQuery / progressQuery / quizTodayQuery / quizDashboardQuery / companySetsQuery`、路由 `/` 与 `/practice`（本任务先渲染占位文本，页面在 Task 7/8 接线）。

- [ ] **Step 1: git mv**

```bash
mkdir -p apps/web/src/styles apps/web/public apps/web/src/api apps/web/src/routes
git mv src/shared apps/web/src/shared
git mv src/entities apps/web/src/entities
git mv src/features apps/web/src/features
git mv src/widgets apps/web/src/widgets
git mv src/views apps/web/src/views
git mv apps/web/src/shared/styles/tokens.css apps/web/src/styles/tokens.css
git mv src/app/favicon.ico apps/web/public/favicon.ico
rmdir apps/web/src/shared/styles
```

- [ ] **Step 2: `index.html`、样式、Vite 配置**

`apps/web/index.html`：
```html
<!doctype html>
<html lang="zh" class="h-full antialiased">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="icon" href="/favicon.ico" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600&family=Barlow:wght@400;500;700&display=swap"
      rel="stylesheet"
    />
    <title>职寻 · 校园招聘岗位看板</title>
    <meta name="description" content="面向在校生的实习与校招岗位索引，附刷题打卡。" />
  </head>
  <body class="flex min-h-full flex-col">
    <div id="root" class="flex min-h-full flex-1 flex-col"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`apps/web/src/styles/globals.css`：
```css
@import "tailwindcss";
@import "./tokens.css";

:root {
  --font-barlow: "Barlow";
  --font-barlow-condensed: "Barlow Condensed";
}
```
`tokens.css` 第 3 行注释改为 `字体族变量在 globals.css 里定义，字体文件由 index.html 的 Google Fonts 链接加载。`

`apps/web/vite.config.ts`：
```ts
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const src = (p: string) => fileURLToPath(new URL(`./src/${p}`, import.meta.url));

export default defineConfig({
  plugins: [tanstackRouter({ target: "react", autoCodeSplitting: true }), react(), tailwindcss()],
  resolve: {
    alias: {
      "@shared": src("shared"),
      "@entities": src("entities"),
      "@features": src("features"),
      "@widgets": src("widgets"),
      "@views": src("views"),
      "@api": src("api"),
    },
  },
  server: {
    port: 5173,
    proxy: { "/api": "http://localhost:3001" },
  },
});
```

- [ ] **Step 3: 入口、router、根路由**

`apps/web/src/main.tsx`：
```tsx
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { queryClient, router } from "./router";
import "./styles/globals.css";

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("#root 不存在");

createRoot(rootEl).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
```

`apps/web/src/router.tsx`：
```tsx
import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

export const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: "intent",
  scrollRestoration: true,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
```

`apps/web/src/routes/__root.tsx`：
```tsx
import type { QueryClient } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: RootLayout,
});

function RootLayout() {
  return (
    <>
      <Outlet />
      {import.meta.env.DEV && (
        <>
          <TanStackRouterDevtools position="bottom-right" />
          <ReactQueryDevtools buttonPosition="bottom-left" />
        </>
      )}
    </>
  );
}
```

`apps/web/src/shared/ui/ErrorPanel.tsx`：
```tsx
import type { ErrorComponentProps } from "@tanstack/react-router";
import { Button } from "./Button";

export function ErrorPanel({ error, reset }: ErrorComponentProps) {
  return (
    <div className="flex flex-col items-start gap-3 px-4 py-10 sm:px-8">
      <p className="font-heading text-xl">页面加载失败</p>
      <p className="text-sm text-neutral-700">{error.message}</p>
      <Button onClick={reset}>重试</Button>
    </div>
  );
}
```

`apps/web/src/routes/index.tsx`（本任务占位，Task 7 替换）：
```tsx
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({ component: () => <p className="p-8">看板（Task 7 接线）</p> });
```

`apps/web/src/routes/practice.tsx`（占位，Task 8 替换）：
```tsx
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/practice")({ component: () => <p className="p-8">刷题（Task 8 接线）</p> });
```

- [ ] **Step 4: RPC client 与 queries**

`apps/web/src/api/client.ts`：
```ts
import type { AppType } from "@job-hunt/api";
import type { ApiErrorBody } from "@job-hunt/shared";
import { type ClientResponse, hc } from "hono/client";

export const api = hc<AppType>("/");

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: ApiErrorBody,
  ) {
    super(body.error.message);
    this.name = "ApiError";
  }
}

/** 解包 RPC 响应：非 2xx 抛 ApiError；204 返回 undefined */
export async function unwrap<T>(req: Promise<ClientResponse<T>>): Promise<T> {
  const res = await req;
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as ApiErrorBody | null;
    throw new ApiError(res.status, body ?? { error: { code: "INTERNAL", message: `HTTP ${res.status}` } });
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
```
若 `ClientResponse<T>` 的泛型参数与 hono 4.13 的定义不匹配（多个状态码联合时 T 推导失败），改为 `unwrap<T>(req: Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>)` 并在调用处标注返回类型；在报告里说明。

`apps/web/src/api/queries.ts`：
```ts
import type { JobListQuery } from "@job-hunt/shared";
import { queryOptions } from "@tanstack/react-query";
import { api, unwrap } from "./client";

/** RPC 的 query 只收字符串；省略 undefined */
function toQuery(q: JobListQuery): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(q)) if (v !== undefined) out[k] = String(v);
  return out;
}

export const jobsQuery = (q: JobListQuery) =>
  queryOptions({
    queryKey: ["jobs", "list", q] as const,
    queryFn: () => unwrap(api.api.jobs.$get({ query: toQuery(q) })),
  });

export const progressQuery = () =>
  queryOptions({ queryKey: ["jobs", "progress"] as const, queryFn: () => unwrap(api.api.jobs.progress.$get()) });

export const quizTodayQuery = () =>
  queryOptions({ queryKey: ["quiz", "today"] as const, queryFn: () => unwrap(api.api.quiz.today.$get()) });

export const quizDashboardQuery = () =>
  queryOptions({ queryKey: ["quiz", "dashboard"] as const, queryFn: () => unwrap(api.api.quiz.dashboard.$get()) });

export const companySetsQuery = () =>
  queryOptions({
    queryKey: ["quiz", "company-sets"] as const,
    queryFn: () => unwrap(api.api.quiz["company-sets"].$get()),
  });
```

- [ ] **Step 5: entities facade 与 Navbar**

删除 `apps/web/src/entities/job/model/{category,query,types}.ts`，新建 `apps/web/src/entities/job/model/ui.ts`：
```ts
import type { ApplicationStatus, JobListItem } from "@job-hunt/shared";

export function isExpired(item: Pick<JobListItem, "daysLeft">): boolean {
  return item.daysLeft !== null && item.daysLeft < 0;
}

export function statusLabel(status: ApplicationStatus | null, expired: boolean): string {
  if (status === "APPLIED") return "已投递";
  if (status === "INTERVIEWING") return "面试中";
  return expired ? "已截止" : "未投递";
}

export function statusVariant(status: ApplicationStatus | null, expired: boolean): "accent" | "neutral" | "outline" {
  if (status === "APPLIED") return "accent";
  if (status === "INTERVIEWING") return "outline";
  return "neutral";
}
```

`apps/web/src/entities/job/index.ts`：
```ts
export type { ApplicationStatus, CategoryId, JobListItem, JobListQuery, JobListResult, JobProgress } from "@job-hunt/shared";
export { CATEGORY, CATEGORY_OPTIONS, isCategoryId, jobListQuerySchema } from "@job-hunt/shared";
export { isExpired, statusLabel, statusVariant } from "./model/ui";
```

`apps/web/src/entities/quiz/index.ts`（整体替换；`model/data.ts` 与 `model/types.ts` 删除）：
```ts
export type {
  CompanySetItem,
  QuizAnswerResult,
  QuizDashboard,
  QuizOption,
  QuizOptionLetter,
  QuizQuestionPublic,
  QuizToday,
  WrongBookItem,
} from "@job-hunt/shared";
```
（`features/quiz-question`、`widgets/practice-sidebar`、`widgets/company-sets` 此时会因为导入不存在的 mock 而 typecheck 失败——**预期**，Task 8 重写它们。本任务把这三个文件与 `views/practice/PracticePage.tsx` 暂时从 typecheck 排除：在 `apps/web/tsconfig.json` 的 `exclude` 里加 `"src/features/quiz-question", "src/widgets/practice-sidebar", "src/widgets/company-sets", "src/views/practice"`，Task 8 再删掉这行。）

`apps/web/src/widgets/navbar/Navbar.tsx`：`import Link from "next/link";` → `import { Link } from "@tanstack/react-router";`；`links` 改为
```ts
const links = [
  { to: "/", label: "岗位信息", key: "jobs" },
  { to: "/practice", label: "刷题", key: "practice" },
] as const;
```
JSX 里 `href={link.href}` → `to={link.to}`。

`views/job-board/JobBoardPage.tsx` 此时仍是 Next 版（用 `next/navigation`），也加入 `exclude`（`"src/views/job-board"`），Task 7 重写后移除。`widgets/job-table`、`widgets/progress-card`、`features/job-filters` 只依赖 `@entities/job` facade，应能通过。

- [ ] **Step 6: 验证**

```bash
pnpm install
pnpm --filter @job-hunt/web typecheck && pnpm exec biome check apps/web
(pnpm --filter @job-hunt/web dev > /tmp/web-dev.log 2>&1 &) ; sleep 5
curl -s localhost:5173/ | grep -c 'src="/src/main.tsx"'
pkill -f "vite" ; true
ls apps/web/src/routeTree.gen.ts
```
Expected：typecheck、biome 清零（biome 对搬过来的文件先 `--write` 自动格式化，剩余 lint 手工修）；`curl` 输出 `1`；`routeTree.gen.ts` 已由插件生成（提交它）。

- [ ] **Step 7: 提交**

```bash
git add -A && git commit -m "feat(web): Vite + TanStack Router/Query 骨架，FSD 目录搬入 apps/web，RPC client"
```

---

### Task 7: `apps/web` 看板页 —— Router search + Query + 乐观更新

**Files:**
- Create: `apps/web/src/api/mutations.ts`
- Modify: `apps/web/src/routes/index.tsx`（替换占位）、`apps/web/src/views/job-board/JobBoardPage.tsx`（重写）、`apps/web/src/features/job-filters/JobFilters.tsx`（仅 import）、`apps/web/tsconfig.json`（移除 `src/views/job-board` 的 exclude）

**Interfaces:**
- Consumes: `jobsQuery / progressQuery`、`api`、`unwrap`；`JobTable`、`JobFilters`、`ProgressCard`、`Navbar` 现有 props 不变。
- Produces: `useToggleFavorite(q)`、`useMarkApplied(q)`（Task 8 不用，但同文件里 Task 8 会追加 quiz 的 mutation）。

- [ ] **Step 1: 路由 `apps/web/src/routes/index.tsx`**

```tsx
import { jobListQuerySchema } from "@job-hunt/shared";
import { createFileRoute, stripSearchParams } from "@tanstack/react-router";
import { jobsQuery, progressQuery } from "@api/queries";
import { ErrorPanel } from "@shared/ui/ErrorPanel";
import { JobBoardPage } from "@views/job-board/JobBoardPage";

/** 等于默认值的 search 不写进 URL */
const defaults = { sort: "deadline", page: 1, pageSize: 20 } as const;

export const Route = createFileRoute("/")({
  validateSearch: jobListQuerySchema,
  search: { middlewares: [stripSearchParams(defaults)] },
  loaderDeps: ({ search }) => search,
  loader: ({ context: { queryClient }, deps }) =>
    Promise.all([queryClient.ensureQueryData(jobsQuery(deps)), queryClient.ensureQueryData(progressQuery())]),
  component: JobBoardPage,
  errorComponent: ErrorPanel,
});
```

- [ ] **Step 2: `apps/web/src/api/mutations.ts`**

```ts
import type { ApplicationStatus, JobListQuery, JobListResult } from "@job-hunt/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, unwrap } from "./client";
import { jobsQuery } from "./queries";

function patchItem(result: JobListResult | undefined, id: number, patch: Partial<JobListResult["items"][number]>) {
  if (!result) return result;
  return { ...result, items: result.items.map((j) => (j.id === id ? { ...j, ...patch } : j)) };
}

export function useToggleFavorite(q: JobListQuery) {
  const qc = useQueryClient();
  const key = jobsQuery(q).queryKey;
  return useMutation({
    mutationFn: ({ id, starred }: { id: number; starred: boolean }) => {
      const param = { id: String(id) };
      return unwrap(starred ? api.api.jobs[":id"].favorite.$put({ param }) : api.api.jobs[":id"].favorite.$delete({ param }));
    },
    onMutate: async ({ id, starred }) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData(key);
      qc.setQueryData(key, (old) => patchItem(old, id, { starred }));
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["jobs"] }),
  });
}

export function useMarkApplied(q: JobListQuery) {
  const qc = useQueryClient();
  const key = jobsQuery(q).queryKey;
  const status: ApplicationStatus = "APPLIED";
  return useMutation({
    mutationFn: ({ id }: { id: number }) =>
      unwrap(api.api.jobs[":id"].application.$put({ param: { id: String(id) }, json: { status } })),
    onMutate: async ({ id }) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData(key);
      qc.setQueryData(key, (old) => patchItem(old, id, { applicationStatus: status }));
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["jobs"] }),
  });
}
```

- [ ] **Step 3: 重写 `apps/web/src/views/job-board/JobBoardPage.tsx`（整体替换）**

```tsx
import type { CategoryId, JobListItem, JobListQuery } from "@job-hunt/shared";
import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, useNavigate } from "@tanstack/react-router";
import { useMarkApplied, useToggleFavorite } from "@api/mutations";
import { jobsQuery, progressQuery } from "@api/queries";
import { type CategoryFilter, JobFilters, type SortOrder } from "@features/job-filters/JobFilters";
import { Button } from "@shared/ui/Button";
import { Input } from "@shared/ui/Input";
import { Kicker } from "@shared/ui/Kicker";
import { Tag } from "@shared/ui/Tag";
import { JobTable } from "@widgets/job-table/JobTable";
import { Navbar } from "@widgets/navbar/Navbar";
import { ProgressCard } from "@widgets/progress-card/ProgressCard";

const route = getRouteApi("/");

function toCsv(rows: JobListItem[]): string {
  const header = ["公司", "岗位", "地点", "分类", "学历要求", "行业", "投递截止", "发布时间", "投递状态", "公告链接"];
  const lines = rows.map((j) =>
    [
      j.company,
      j.positions.join("；"),
      j.cities.join("；"),
      j.categoryLabel,
      j.degree ?? "",
      j.industry ?? "",
      j.deadlineText ?? "",
      j.postedAt,
      j.applicationStatus ?? "",
      j.announcementLink ?? "",
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(","),
  );
  return [header.join(","), ...lines].join("\n");
}

export function JobBoardPage() {
  const search = route.useSearch();
  const navigate = useNavigate({ from: "/" });
  const { data: result } = useSuspenseQuery(jobsQuery(search));
  const { data: progress } = useSuspenseQuery(progressQuery());
  const toggleFavorite = useToggleFavorite(search);
  const markApplied = useMarkApplied(search);

  /** 局部更新 URL search；city 传 "全部" 表示清除；除翻页外都回到第 1 页 */
  function update(patch: Partial<JobListQuery>, { keepPage = false } = {}) {
    navigate({
      replace: true,
      search: (prev) => {
        const next: JobListQuery = { ...prev, ...(keepPage ? {} : { page: 1 }), ...patch };
        if (next.city === "全部") next.city = undefined;
        return next;
      },
    });
  }

  function handleExport() {
    const blob = new Blob([toCsv(result.items)], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "岗位列表.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));
  const from = result.total === 0 ? 0 : (result.page - 1) * result.pageSize + 1;
  const to = Math.min(result.total, result.page * result.pageSize);

  return (
    <div className="flex min-h-full flex-col bg-bg">
      <Navbar active="jobs" trailing="2027 届 · 秋招进行中" />

      <section className="grid grid-cols-1 items-end gap-8 border-b border-divider px-4 pb-7 pt-8 sm:px-8 sm:pt-10 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-10">
        <div>
          <Kicker className="mb-2.5 text-accent-700">面向在校生的岗位索引</Kicker>
          <h1 className="text-[32px] sm:text-[42px] lg:text-[52px]">把散落各处的招聘信息，收进一张表</h1>
          <p className="mt-3.5 max-w-[640px] text-[15px] text-neutral-700">
            秋招、央国企、外企的招聘公告收进一张表，标注学历要求与投递截止，收藏、投递状态自己管。
          </p>
          <form
            className="mt-5 flex max-w-[560px] flex-col gap-2.5 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              const q = new FormData(e.currentTarget).get("q");
              const trimmed = typeof q === "string" ? q.trim() : "";
              update({ q: trimmed || undefined });
            }}
          >
            <Input name="q" placeholder="搜索公司、岗位或行业" className="min-h-10 sm:flex-1" defaultValue={search.q ?? ""} />
            <Button type="submit" variant="primary" size="lg" blueprint className="min-h-10 px-6">
              检索
            </Button>
          </form>
        </div>
        <ProgressCard progress={progress} />
      </section>

      <div className="flex flex-col gap-2 border-b border-divider bg-accent-100 px-4 py-3 sm:flex-row sm:items-center sm:gap-3.5 sm:px-8">
        <Tag variant="solid" className="self-start">
          本周新增
        </Tag>
        <p className="text-sm">
          新上 <b className="tabular-nums">{progress.newThisWeek}</b> 条公告，其中实习{" "}
          <b className="tabular-nums">{progress.newInternshipsThisWeek}</b> 条
        </p>
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => update({ sort: "posted", city: "全部", category: undefined })}
          className="cursor-pointer self-start text-[13px] text-accent-700 hover:text-accent-900 sm:self-auto"
        >
          只看本周新增 →
        </button>
      </div>

      <JobFilters
        query={search.q ?? ""}
        onQueryChange={(q) => update({ q: q || undefined })}
        category={(search.category ? String(search.category) : "all") as CategoryFilter}
        onCategoryChange={(c) => update({ category: c === "all" ? undefined : (Number(c) as CategoryId) })}
        city={search.city ?? "全部"}
        onCityChange={(city) => update({ city })}
        sort={search.sort}
        onSortChange={(sort: SortOrder) => update({ sort })}
        onExport={handleExport}
      />

      <JobTable
        jobs={result.items}
        onToggleStar={(id) => {
          const job = result.items.find((j) => j.id === id);
          if (job) toggleFavorite.mutate({ id, starred: !job.starred });
        }}
        onMarkApplied={(id) => markApplied.mutate({ id })}
      />

      <div className="flex flex-col items-center justify-between gap-3 px-4 pb-10 pt-5 sm:flex-row sm:px-8">
        <span className="text-xs tabular-nums text-neutral-700">
          显示 {from}–{to}，共 <b>{result.total}</b> 条
        </span>
        <div className="flex items-center gap-1.5">
          <Button disabled={result.page <= 1} onClick={() => update({ page: result.page - 1 }, { keepPage: true })}>
            上一页
          </Button>
          <Button variant="primary" disabled className="min-w-9 tabular-nums">
            {result.page} / {totalPages}
          </Button>
          <Button disabled={result.page >= totalPages} onClick={() => update({ page: result.page + 1 }, { keepPage: true })}>
            下一页
          </Button>
        </div>
      </div>
    </div>
  );
}
```
（原文件的 `"use client"`、`useRouter`、`useState`、`prevResult`、`patchItem`、`toggleStar`、`markApplied`、`buildHref`、`NavPatch` 全部不再存在。）

`apps/web/src/features/job-filters/JobFilters.tsx`：不改逻辑；`import { CATEGORY_OPTIONS } from "@entities/job";` 保持（facade 已指向 shared）。

`apps/web/tsconfig.json` 的 `exclude` 移除 `"src/views/job-board"`。

- [ ] **Step 4: 验证（api + web 同时起）**

```bash
pnpm --filter @job-hunt/web typecheck && pnpm exec biome check apps/web
(pnpm --filter @job-hunt/api dev > /tmp/api-dev.log 2>&1 &) ; (pnpm --filter @job-hunt/web dev > /tmp/web-dev.log 2>&1 &) ; sleep 6
curl -s "localhost:5173/api/jobs?pageSize=1" | head -c 200; echo
```
然后用浏览器工具打开 `http://localhost:5173/`，逐项确认：
1. 列表有数据；点分类"央国企"→ URL 变成 `/?category=2`，列表变化；刷新后仍是分类 2。
2. 在筛选搜索框输入"泡泡"→ 300ms 后 URL 带 `q=泡泡`。
3. 点某行 ☆ → 立即变 ★，进度卡片"已收藏"+1；刷新后仍是 ★。
4. 点"标记已投"→ 按钮变"已投递"，进度卡片"已投递"+1。
5. 排序切"最新发布"→ URL `sort=posted`；切回"截止最近"→ URL 里 `sort` 消失。
6. 翻到第 2 页（若数据够）→ `page=2`；改分类后回到无 `page`。
截图一张放到报告里。结束后 `pkill -f "tsx watch src/index.ts"; pkill -f vite`。

- [ ] **Step 5: 提交**

```bash
git add -A && git commit -m "feat(web): 看板页接 TanStack Router search + Query，收藏/投递乐观更新"
```

---

### Task 8: `apps/web` 刷题页 —— today / dashboard / attempts / 错题本

**Files:**
- Modify: `apps/web/src/routes/practice.tsx`（替换占位）、`apps/web/src/api/mutations.ts`（追加两个 hook）、`apps/web/src/views/practice/PracticePage.tsx`、`apps/web/src/features/quiz-question/QuizQuestion.tsx`、`apps/web/src/widgets/practice-sidebar/PracticeSidebar.tsx`、`apps/web/src/widgets/company-sets/CompanySets.tsx`、`apps/web/tsconfig.json`（删除所有 exclude）

**Interfaces:**
- Consumes: `quizTodayQuery / quizDashboardQuery / companySetsQuery`、shared 的 quiz 类型。
- Produces: `useSubmitAttempt()`、`useSetMastered()`。

- [ ] **Step 1: 路由**

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { companySetsQuery, quizDashboardQuery, quizTodayQuery } from "@api/queries";
import { ErrorPanel } from "@shared/ui/ErrorPanel";
import { PracticePage } from "@views/practice/PracticePage";

export const Route = createFileRoute("/practice")({
  loader: ({ context: { queryClient } }) =>
    Promise.all([
      queryClient.ensureQueryData(quizTodayQuery()),
      queryClient.ensureQueryData(quizDashboardQuery()),
      queryClient.ensureQueryData(companySetsQuery()),
    ]),
  component: PracticePage,
  errorComponent: ErrorPanel,
});
```

- [ ] **Step 2: mutations 追加**

```ts
import type { QuizDashboard, QuizOptionLetter } from "@job-hunt/shared";
import { quizDashboardQuery } from "./queries";

export function useSubmitAttempt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { questionId: string; picked: QuizOptionLetter }) =>
      unwrap(api.api.quiz.attempts.$post({ json: vars })),
    // 答完题打卡/错题本会变；today 留到用户点"下一题"再失效
    onSuccess: () => qc.invalidateQueries({ queryKey: quizDashboardQuery().queryKey }),
  });
}

export function useSetMastered() {
  const qc = useQueryClient();
  const key = quizDashboardQuery().queryKey;
  return useMutation({
    mutationFn: ({ questionId, mastered }: { questionId: string; mastered: boolean }) =>
      unwrap(api.api.quiz["wrong-book"][":questionId"].$put({ param: { questionId }, json: { mastered } })),
    onMutate: async ({ questionId, mastered }) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData(key);
      if (mastered) {
        qc.setQueryData(key, (old: QuizDashboard | undefined) =>
          old ? { ...old, wrongList: old.wrongList.filter((w) => w.questionId !== questionId) } : old,
        );
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });
}
```

- [ ] **Step 3: `PracticePage.tsx`（整体替换）**

```tsx
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useSetMastered, useSubmitAttempt } from "@api/mutations";
import { companySetsQuery, quizDashboardQuery, quizTodayQuery } from "@api/queries";
import { QuizQuestion } from "@features/quiz-question/QuizQuestion";
import { Kicker } from "@shared/ui/Kicker";
import { CompanySets } from "@widgets/company-sets/CompanySets";
import { Navbar } from "@widgets/navbar/Navbar";
import { PracticeSidebar } from "@widgets/practice-sidebar/PracticeSidebar";

export function PracticePage() {
  const qc = useQueryClient();
  const { data: today } = useSuspenseQuery(quizTodayQuery());
  const { data: dashboard } = useSuspenseQuery(quizDashboardQuery());
  const { data: sets } = useSuspenseQuery(companySetsQuery());
  const submit = useSubmitAttempt();
  const setMastered = useSetMastered();
  const question = today.question;

  function nextQuestion() {
    submit.reset();
    qc.invalidateQueries({ queryKey: quizTodayQuery().queryKey });
  }

  return (
    <div className="flex min-h-full flex-col bg-bg">
      <Navbar active="practice" trailing={`连续打卡 ${dashboard.streakDays} 天`} />

      <div className="grid grid-cols-1 border-b border-divider lg:grid-cols-[minmax(0,1fr)_300px]">
        {question ? (
          <QuizQuestion
            key={question.id}
            question={question}
            date={today.date}
            indexLabel={today.indexLabel}
            result={submit.data ?? null}
            submitting={submit.isPending}
            onSubmit={(picked) => submit.mutate({ questionId: question.id, picked })}
            onNext={nextQuestion}
          />
        ) : (
          <div className="px-4 py-8 sm:px-8 sm:py-9">
            <Kicker className="text-accent-700">今日一题</Kicker>
            <h2 className="mt-3 text-[22px] sm:text-[26px]">题库已全部答完</h2>
            <p className="mt-2 text-sm text-neutral-700">今天已答 {today.attemptedToday} 题，去错题本复习一下吧。</p>
          </div>
        )}
        <PracticeSidebar
          dashboard={dashboard}
          onMastered={(questionId) => setMastered.mutate({ questionId, mastered: true })}
        />
      </div>

      <CompanySets items={sets.items} />
    </div>
  );
}
```

- [ ] **Step 4: `QuizQuestion.tsx` 改受控**

props 与状态：
```tsx
import type { QuizAnswerResult, QuizOption, QuizOptionLetter, QuizQuestionPublic } from "@entities/quiz";

interface QuizQuestionProps {
  question: QuizQuestionPublic;
  date: string;
  indexLabel: string;
  result: QuizAnswerResult | null;
  submitting: boolean;
  onSubmit: (picked: QuizOptionLetter) => void;
  onNext: () => void;
}

export function QuizQuestion({ question, date, indexLabel, result, submitting, onSubmit, onNext }: QuizQuestionProps) {
  const [picked, setPicked] = useState<QuizOptionLetter | null>(null);
  const revealed = result !== null;
```
- `optionState(option, picked, revealed, result?.answer ?? "")`。
- 头部 Kicker：`今日一题 · {date.slice(5).replace("-", " / ")}`；`{indexLabel}`。
- 选项按钮 `disabled={revealed}`；`onClick={() => setPicked(option.letter)}`。
- 按钮区替换为：
```tsx
<Button variant="primary" size="lg" blueprint className="px-5" disabled={!picked || submitting || revealed} onClick={() => picked && onSubmit(picked)}>
  {submitting ? "提交中…" : "提交并查看答案"}
</Button>
<Button variant="ghost" size="lg" disabled={!revealed} onClick={onNext}>下一题 →</Button>
```
（删除"加入错题本""标记已掌握"两个按钮——答错自动进错题本，掌握在侧栏操作。）
- 解析区 `revealed && result && (...)`：`答案 {result.answer}`；Tag 文案 `result.correct ? "回答正确" : "回答错误 · 已加入错题本"`；正确率 `result.accuracyRate === null ? "暂无统计" : \`本题正确率 ${result.accuracyRate}%\``；段落来自 `result.explanation`。
- 删除 `"use client"` 行（所有搬过来的组件都删掉这一行，它是 Next 专用）。

- [ ] **Step 5: `PracticeSidebar.tsx` 改 props**

```tsx
import type { QuizDashboard } from "@entities/quiz";

interface PracticeSidebarProps {
  dashboard: QuizDashboard;
  onMastered: (questionId: string) => void;
}

export function PracticeSidebar({ dashboard, onMastered }: PracticeSidebarProps) {
  const { streakDays, week, weekSolved, weekTarget, totalSolved, categories, wrongList } = dashboard;
```
- 打卡区、本周/累计：变量名与原来一致，直接用解构出的值；`weekCheckins` → `week`。
- 题库分类：`<button>` 改为 `<div className="flex items-center justify-between border-b border-hairline py-2.5 text-sm">`（没有点击行为就不用 button），去掉 `highlighted`。
- 错题本每项：
```tsx
<li key={w.questionId} className="flex items-center justify-between gap-2.5 text-[13px]">
  <span className="truncate">{w.title}</span>
  <span className="flex shrink-0 items-center gap-1.5">
    <Tag className="text-[10px]">{w.due}</Tag>
    <button type="button" onClick={() => onMastered(w.questionId)} className="cursor-pointer text-[11px] text-accent-700 hover:text-accent-900">已掌握</button>
  </span>
</li>
```
- 列表为空时显示 `<p className="text-[13px] text-neutral-700">暂无错题</p>`；删除"开始复习 N 题"按钮。

- [ ] **Step 6: `CompanySets.tsx` 改 props**

```tsx
import type { CompanySetItem } from "@entities/quiz";

export function CompanySets({ items }: { items: CompanySetItem[] }) {
```
`companySets.map` → `items.map`，`key={s.id}`，`{s.kicker}` → `{s.track}`。

- [ ] **Step 7: 移除 tsconfig exclude，验证**

`apps/web/tsconfig.json` 删掉整个 `exclude`。

```bash
pnpm --filter @job-hunt/web typecheck && pnpm exec biome check apps/web
(pnpm --filter @job-hunt/api dev > /tmp/api-dev.log 2>&1 &) ; (pnpm --filter @job-hunt/web dev > /tmp/web-dev.log 2>&1 &) ; sleep 6
```
浏览器打开 `http://localhost:5173/practice`：
1. 显示今日题（分类 / 难度 / 来源 Tag、`试题 N / 20`）。
2. 选一个错误选项 → 提交 → 出现解析、"回答错误 · 已加入错题本"；侧栏错题本多一条、"天连续"变 1、本周格子今天变实心。
3. 点"下一题 →"→ 题目换成下一道，选项清空。
4. 侧栏错题点"已掌握"→ 立即消失，刷新后仍消失。
5. 公司题集四张卡，各显示 `3 题`。
截图放报告。结束后杀掉两个进程。

- [ ] **Step 8: 提交**

```bash
git add -A && git commit -m "feat(web): 刷题页接线 —— 今日题、作答解析、打卡仪表盘、错题本、公司题集"
```

---

### Task 9: 清理 Next.js 残留、README、AGENTS.md、最终门禁

**Files:**
- Delete: `src/`（整个目录：`app/`、`server/` 剩余、`generated/`）、`next.config.*`、`next-env.d.ts`、`postcss.config.*`、`eslint.config.*`、`tsconfig.json`（根）、`.next/`、`public/`（根，若存在且无内容被引用）
- Modify: `AGENTS.md`（整体替换）、`README.md`（整体替换）、`.env.example`（若有 Next 相关变量，删掉）、`docker-compose.yml`（不改）

**Interfaces:** 无新增。

- [ ] **Step 1: 删除**

```bash
git rm -rq src next.config.ts next-env.d.ts postcss.config.mjs eslint.config.mjs tsconfig.json 2>/dev/null; ls next.config.* postcss.config.* eslint.config.* 2>/dev/null
rm -rf .next
git status --short | head -30
```
Expected：`ls` 没有输出（所有 Next 配置都已删）。若根 `public/` 存在，检查内容是否被 `apps/web` 引用；未引用则 `git rm -r public`。

- [ ] **Step 2: `AGENTS.md`（整体替换）**

```markdown
# 项目约定

pnpm monorepo：`apps/api`（Hono + Prisma 7，Node 22）、`apps/web`（React 19 + Vite + TanStack Router/Query + Tailwind v4）、`packages/shared`（zod schema + DTO 类型）。

- 任何命令前先 `nvm use`（`.nvmrc` = 22），用 `pnpm` 不用 npm。
- 数据库：`pnpm db:up`（docker，端口 5433），连接串在根 `.env`。
- 后端路由必须链式定义（`new Hono<Env>().get(...).put(...)`），否则前端 RPC 类型丢失。
- 前端只能 `import type` 来自 `@job-hunt/api`。
- 日期边界只经 `apps/api/src/lib/dates.ts`（Asia/Shanghai）。
- 提交前：`pnpm typecheck && pnpm lint && pnpm test`。
- 库文档在 `node_modules/<pkg>/` 里，Hono / TanStack / Prisma 7 的 API 与旧版本有差异，先看文档再写。
```

- [ ] **Step 3: `README.md`（整体替换）**

```markdown
# 职寻 · 校园招聘岗位看板

前后端分离的 pnpm monorepo。

| 包 | 说明 | 端口 |
|---|---|---|
| `apps/api` | Hono + Prisma 7 + PostgreSQL 的 REST API | 3001 |
| `apps/web` | React 19 + Vite + TanStack Router/Query + Tailwind v4 | 5173 |
| `packages/shared` | 前后端共用的 zod schema 与 DTO 类型 | — |

## 首次启动

```bash
nvm use                 # Node 22
corepack enable pnpm
pnpm install            # 会自动 prisma generate
cp .env.example .env    # DATABASE_URL 指向 docker 里的 Postgres（5433）
pnpm db:up              # 启动 Postgres
pnpm db:migrate         # 建表
pnpm db:seed            # 开发账号 + 20 道题
pnpm db:import -- /path/to/岗位.xlsx   # 导入你的 Excel（多工作表；按表名推断分类）
pnpm dev                # api :3001 + web :5173
```

打开 http://localhost:5173 。

## 常用命令

- `pnpm typecheck` / `pnpm lint` / `pnpm test`（api 的集成测试需要数据库在线）
- `pnpm format` —— Biome 格式化
- `pnpm --filter @job-hunt/api exec prisma studio` —— 看数据

## 接口

所有接口在 `/api` 下，JSON；错误统一 `{ error: { code, message, issues? } }`。端点清单见 `apps/api/src/routes/*.ts`；前端通过 Hono RPC（`apps/web/src/api/client.ts`）获得端到端类型。

## Excel 导入

- 每个工作表一个分类：表名含"秋招"/"实习"→1，"央国企"/"国企"→2，"外企"→3。
- 有 `id` 列时按 id upsert；否则按 `serialNumber`；再否则插入。按 id 导入后脚本会提示执行 `setval` 让自增序列跟上。
```

- [ ] **Step 4: 最终门禁**

```bash
pnpm install
pnpm typecheck && pnpm lint && pnpm test
pnpm --filter @job-hunt/web build && ! grep -rl "PrismaClient" apps/web/dist && echo "bundle clean"
git grep -l 'from "next' -- apps packages; echo "exit=$?"
ls src .next 2>&1 | head -2
```
Expected：typecheck / lint / test 全绿（test：shared 6 + api 56）；`bundle clean`；`git grep` 无输出且 `exit=1`；`ls` 报两者都不存在。

- [ ] **Step 5: 端到端复核**

起 api + web，浏览器过一遍 spec 第 9 节的验收清单（看板 6 项 + 刷题 5 项），每项一行结果写进报告；杀进程。

- [ ] **Step 6: 提交**

```bash
git add -A && git commit -m "chore: 移除 Next.js 残留，README / AGENTS.md 更新为 monorepo"
```
