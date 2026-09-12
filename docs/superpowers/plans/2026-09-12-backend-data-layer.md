# 后端数据层 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把岗位看板和刷题页从写死的 mock 切换到 PostgreSQL，提供服务层、REST 接口、Excel 导入脚本和种子数据。

**Architecture:** Prisma → `src/server/services/`（纯函数，返回 DTO）→ 两个出口：`src/app/api/**/route.ts`（zod 校验的薄壳）和 Server Component（页面首屏直接调用，不 fetch 自己的 API）。浏览器端写操作走 `fetch('/api/...')` + 乐观更新。所有"某用户对某物"的状态挂在种子开发账号上，`getCurrentUserId()` 是未来登录的唯一接缝。

**Tech Stack:** Next.js 16.3.4 (App Router, Turbopack) · React 19 · Prisma 7.10 + `@prisma/adapter-pg` · PostgreSQL 16 (docker) · zod 4 · exceljs 4.4 · vitest 5 · tsx

**Spec:** `docs/superpowers/specs/2026-09-12-backend-data-layer-design.md`

## Global Constraints

- Node.js **≥ 20.19**（Prisma 7 硬要求；本机当前 v20.15.1，Task 1 升级）
- Prisma 7：`schema.prisma` 里 **不写** `url`，连接串只在 `prisma.config.ts`；generator 必须是 `prisma-client` 且 `output` 必填；客户端必须带 `PrismaPg` 适配器实例化
- 时区 `Asia/Shanghai`："今天""本周"边界一律通过 `src/server/lib/dates.ts` 计算，禁止在别处 `new Date().getDate()`
- `src/server/**` 只在服务端运行；`services/*.ts` 与 `auth.ts` 首行 `import "server-only"`；`db.ts` 和 `lib/*.ts` **不加**（seed / 导入脚本要用）
- 页面首屏不 fetch 自己的 `/api`
- REST 错误统一 `{ error: { code, message, issues? } }`；200 / 204 / 400 / 404 / 500
- 不引入 SWR / React Query；不做登录；不做定时同步
- 本项目当前 **不是 git 仓库**。Task 1 Step 1 会 `git init`；如果用户不想要 git，跳过所有 Commit 步骤
- 已有 dev server 可能占着 3000 端口（用户在终端里跑的），验证时直接访问 `http://localhost:3000`，不要再起一个

---

## 文件结构

```
prisma.config.ts                      Prisma 7 配置：schema 路径、迁移目录、seed 命令、DATABASE_URL
prisma/schema.prisma                  全部模型
prisma/seed.ts                        开发账号 + 题库种子
docker-compose.yml                    postgres:16
.env.example                          DATABASE_URL 模板
vitest.config.ts                      别名 + include
scripts/import-jobs.ts                xlsx → Job（只做 IO，行映射在 lib 里）

src/generated/prisma/                 prisma generate 产物（gitignore）

src/server/db.ts                      PrismaClient 单例（带 PrismaPg 适配器）
src/server/auth.ts                    getCurrentUserId()
src/server/lib/dates.ts               时区安全的日期工具（纯）
src/server/lib/parse.ts               splitMulti / parseDeadline / splitGradDegree（纯）
src/server/lib/job-row.ts             Excel 行 → Job 创建输入（纯）
src/server/lib/job-dto.ts             Prisma Job 行 → JobListItem（纯）
src/server/lib/http.ts                route 共用：json() / handle() / NotFoundError
src/server/services/jobs.ts           listJobs / setFavorite / setApplication / getProgress
src/server/services/quiz.ts           getTodayQuestion / submitAnswer / getDashboard / listWrongBook / setMastered / listCompanySets
src/server/services/users.ts          getCurrentUser

src/entities/job/model/category.ts    CATEGORY 映射（客户端也要用，所以放 entities 而非 server/lib）
src/entities/job/model/query.ts       jobListQuerySchema（zod）+ JobListQuery 类型
src/entities/job/model/types.ts       JobListItem / JobProgress DTO 类型（替换旧 Job）
src/entities/quiz/model/types.ts      quiz DTO 类型

src/app/api/jobs/route.ts
src/app/api/jobs/[id]/favorite/route.ts
src/app/api/jobs/[id]/application/route.ts
src/app/api/quiz/today/route.ts
src/app/api/quiz/attempts/route.ts
src/app/api/quiz/dashboard/route.ts
src/app/api/quiz/wrong-book/route.ts
src/app/api/quiz/wrong-book/[questionId]/route.ts
src/app/api/quiz/company-sets/route.ts
src/app/api/me/route.ts
```

修改：`package.json` `.gitignore` `src/app/page.tsx` `src/app/practice/page.tsx` `src/views/job-board/JobBoardPage.tsx` `src/views/practice/PracticePage.tsx` `src/features/job-filters/JobFilters.tsx` `src/features/quiz-question/QuizQuestion.tsx` `src/widgets/job-table/JobTable.tsx` `src/widgets/progress-card/ProgressCard.tsx` `src/widgets/practice-sidebar/PracticeSidebar.tsx` `src/widgets/company-sets/CompanySets.tsx` `src/entities/job/index.ts` `src/entities/quiz/index.ts`

删除：`src/entities/job/model/data.ts` `src/entities/job/lib/presentation.ts` `src/entities/quiz/model/data.ts`

---

### Task 1: 基础设施 —— Node、依赖、Docker、Prisma 7、迁移、测试框架

**Files:**
- Create: `docker-compose.yml`, `.env.example`, `.env`, `prisma.config.ts`, `prisma/schema.prisma`, `src/server/db.ts`, `vitest.config.ts`, `.gitignore`
- Modify: `package.json`

**Interfaces:**
- Produces: `prisma` 单例 `import { prisma } from "@/server/db"`；生成的类型 `import type { Job, User, ... } from "@/generated/prisma/client"`；枚举 `import { AppStatus, Difficulty } from "@/generated/prisma/enums"`

- [ ] **Step 1: 初始化 git（可选）并升级 Node**

```bash
git init 2>/dev/null || true
node -v          # 若 < v20.19.0，执行下面两行
nvm install 22 && nvm use 22
node -v          # 期望 v22.x
```

没有 nvm 的话用 `brew install node@22` 或从 nodejs.org 装 22 LTS。

- [ ] **Step 2: 安装依赖**

```bash
npm install @prisma/client@7 @prisma/adapter-pg@7 server-only
npm install -D prisma@7 exceljs tsx vitest dotenv
```

- [ ] **Step 3: 写 `.gitignore` 追加项**

在 `.gitignore` 末尾追加（文件若不存在则创建）：

```
.env
src/generated/
```

- [ ] **Step 4: 写 `docker-compose.yml`**

```yaml
services:
  db:
    image: postgres:16
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: job_hunt
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
volumes:
  pgdata:
```

- [ ] **Step 5: 写 `.env.example` 并复制为 `.env`**

```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/job_hunt
```

```bash
cp .env.example .env
```

- [ ] **Step 6: 写 `prisma.config.ts`**

```ts
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

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

- [ ] **Step 7: 写 `prisma/schema.prisma`（全部模型，一次到位）**

```prisma
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}

datasource db {
  provider = "postgresql"
}

// ── 用户 ──────────────────────────────────────────────

model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String
  createdAt DateTime @default(now())

  favorites    Favorite[]
  applications Application[]
  attempts     Attempt[]
  wrongBook    WrongBookEntry[]
}

// ── 岗位（用户现有 Excel 结构）────────────────────────

model Job {
  id               Int       @id @default(autoincrement())
  serialNumber     String?
  categoryId       Int
  recruitmentBatch String?
  enterpriseNature String?
  industry         String?
  workLocation     String?
  position         String
  enterpriseName   String
  graduationYear   String?
  degree           String?
  announcementLink String?
  deliveryAddress  String?
  deadline         String?
  deadlineAt       DateTime? @db.Date
  createTime       DateTime  @default(now())
  updateTime       DateTime  @updatedAt

  favorites    Favorite[]
  applications Application[]

  @@index([categoryId, deadlineAt])
  @@index([createTime])
}

model Favorite {
  userId String
  jobId  Int
  user   User @relation(fields: [userId], references: [id], onDelete: Cascade)
  job    Job  @relation(fields: [jobId], references: [id], onDelete: Cascade)

  @@id([userId, jobId])
}

enum AppStatus {
  APPLIED
  INTERVIEWING
}

model Application {
  userId    String
  jobId     Int
  status    AppStatus
  updatedAt DateTime @updatedAt
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  job       Job      @relation(fields: [jobId], references: [id], onDelete: Cascade)

  @@id([userId, jobId])
}

// ── 刷题 ──────────────────────────────────────────────

enum Difficulty {
  EASY
  MEDIUM
  HARD
}

model QuestionCategory {
  id        String     @id @default(cuid())
  name      String     @unique
  questions Question[]
}

model CompanySet {
  id        String     @id @default(cuid())
  company   String
  track     String
  focus     String
  questions Question[]
}

model Question {
  id           String            @id @default(cuid())
  categoryId   String
  companySetId String?
  prompt       String
  options      Json
  answer       String
  explanation  String[]
  difficulty   Difficulty
  source       String
  category     QuestionCategory  @relation(fields: [categoryId], references: [id])
  companySet   CompanySet?       @relation(fields: [companySetId], references: [id])
  attempts     Attempt[]
  wrongBook    WrongBookEntry[]
}

model Attempt {
  id         String   @id @default(cuid())
  userId     String
  questionId String
  picked     String
  correct    Boolean
  answeredAt DateTime @default(now())
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  question   Question @relation(fields: [questionId], references: [id], onDelete: Cascade)

  @@index([userId, answeredAt])
  @@index([questionId])
}

model WrongBookEntry {
  userId       String
  questionId   String
  nextReviewAt DateTime
  mastered     Boolean  @default(false)
  addedAt      DateTime @default(now())
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  question     Question @relation(fields: [questionId], references: [id], onDelete: Cascade)

  @@id([userId, questionId])
}
```

- [ ] **Step 8: 写 `src/server/db.ts`**

```ts
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

function createClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

- [ ] **Step 9: 写 `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@shared": path.resolve(__dirname, "src/shared"),
      "@entities": path.resolve(__dirname, "src/entities"),
      "@features": path.resolve(__dirname, "src/features"),
      "@widgets": path.resolve(__dirname, "src/widgets"),
      "@pages": path.resolve(__dirname, "src/views"),
    },
  },
});
```

- [ ] **Step 10: 在 `package.json` 的 `scripts` 里追加**

```json
"postinstall": "prisma generate",
"db:up": "docker compose up -d",
"db:migrate": "prisma migrate dev",
"db:seed": "prisma db seed",
"db:import": "tsx scripts/import-jobs.ts",
"test": "vitest run"
```

- [ ] **Step 11: 起库、迁移、生成客户端**

```bash
npm run db:up
npx prisma migrate dev --name init
```

期望：输出 `Your database is now in sync with your schema.`，并且 `src/generated/prisma/client.ts` 存在。

- [ ] **Step 12: 验证类型与空测试**

```bash
npx tsc --noEmit
npm test
```

期望：tsc 无输出；vitest 提示 `No test files found`（退出码 0 或 1 都可，这一步只确认配置能加载）。

若 `next dev` 报 `pg` 相关的打包错误，在 `next.config.ts` 加 `serverExternalPackages: ["@prisma/adapter-pg", "pg"]`。

- [ ] **Step 13: Commit**

```bash
git add -A
git commit -m "chore: postgres + prisma 7 + vitest 基础设施与全部数据模型"
```

---

### Task 2: 纯函数 —— 日期工具与数据清洗（TDD）

**Files:**
- Create: `src/server/lib/dates.ts`, `src/server/lib/dates.test.ts`, `src/server/lib/parse.ts`, `src/server/lib/parse.test.ts`

**Interfaces:**
- Produces:
  - `dateKey(d?: Date): string` — 上海时区的 `"YYYY-MM-DD"`
  - `keyToDate(key: string): Date` — UTC 00:00，用于和 `@db.Date` 列比较
  - `keyToInstant(key: string): Date` — 上海 00:00 的真实时刻，用于和 `DateTime` 列比较
  - `addDays(key: string, n: number): string`
  - `daysBetween(fromKey: string, toKey: string): number` — `to - from`
  - `weekStartKey(key: string): string` — 该周周一
  - `computeStreak(keys: Set<string>, todayKey: string): number`
  - `dueLabel(nextReviewAt: Date, todayKey: string): string`
  - `splitMulti(text: string | null | undefined): string[]`
  - `parseDeadline(text: string | null | undefined, todayKey?: string): string | null` — 返回 `"YYYY-MM-DD"` 或 null
  - `splitGradDegree(cell: string | null | undefined): { graduationYear: string | null; degree: string | null }`

- [ ] **Step 1: 写 `src/server/lib/dates.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import {
  addDays,
  computeStreak,
  daysBetween,
  dateKey,
  dueLabel,
  keyToDate,
  keyToInstant,
  weekStartKey,
} from "./dates";

describe("dateKey", () => {
  it("按上海时区取日期（UTC 16:00 已是上海次日）", () => {
    expect(dateKey(new Date("2026-09-11T16:30:00Z"))).toBe("2026-09-12");
    expect(dateKey(new Date("2026-09-11T15:30:00Z"))).toBe("2026-09-11");
  });
});

describe("keyToDate / keyToInstant", () => {
  it("keyToDate 是 UTC 零点", () => {
    expect(keyToDate("2026-09-12").toISOString()).toBe("2026-09-12T00:00:00.000Z");
  });
  it("keyToInstant 是上海零点", () => {
    expect(keyToInstant("2026-09-12").toISOString()).toBe("2026-09-11T16:00:00.000Z");
  });
});

describe("addDays / daysBetween / weekStartKey", () => {
  it("加减天数跨月", () => {
    expect(addDays("2026-09-30", 1)).toBe("2026-10-01");
    expect(addDays("2026-10-01", -1)).toBe("2026-09-30");
  });
  it("daysBetween 为 to - from", () => {
    expect(daysBetween("2026-09-12", "2026-11-30")).toBe(79);
    expect(daysBetween("2026-09-12", "2026-09-10")).toBe(-2);
  });
  it("周一为一周起点", () => {
    expect(weekStartKey("2026-09-12")).toBe("2026-09-07"); // 周六
    expect(weekStartKey("2026-09-07")).toBe("2026-09-07"); // 周一
    expect(weekStartKey("2026-09-13")).toBe("2026-09-07"); // 周日
  });
});

describe("computeStreak", () => {
  it("今天有作答，从今天往回数", () => {
    const keys = new Set(["2026-09-12", "2026-09-11", "2026-09-10", "2026-09-08"]);
    expect(computeStreak(keys, "2026-09-12")).toBe(3);
  });
  it("今天没有但昨天有，从昨天往回数", () => {
    const keys = new Set(["2026-09-11", "2026-09-10"]);
    expect(computeStreak(keys, "2026-09-12")).toBe(2);
  });
  it("今天昨天都没有为 0", () => {
    expect(computeStreak(new Set(["2026-09-10"]), "2026-09-12")).toBe(0);
    expect(computeStreak(new Set(), "2026-09-12")).toBe(0);
  });
});

describe("dueLabel", () => {
  const today = "2026-09-12";
  it("已到期 / 今天 / 明天 / N 天后", () => {
    expect(dueLabel(keyToInstant("2026-09-10"), today)).toBe("已到期");
    expect(dueLabel(keyToInstant("2026-09-12"), today)).toBe("今天");
    expect(dueLabel(keyToInstant("2026-09-13"), today)).toBe("明天");
    expect(dueLabel(keyToInstant("2026-09-15"), today)).toBe("3 天后");
  });
});
```

- [ ] **Step 2: 运行，确认失败**

```bash
npx vitest run src/server/lib/dates.test.ts
```

期望：FAIL，`Cannot find module './dates'`。

- [ ] **Step 3: 写 `src/server/lib/dates.ts`**

```ts
const TZ = "Asia/Shanghai";
const DAY_MS = 86_400_000;

const keyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** 上海时区下的 "YYYY-MM-DD" */
export function dateKey(d: Date = new Date()): string {
  return keyFormatter.format(d);
}

/** UTC 零点；和 @db.Date 列比较时用 */
export function keyToDate(key: string): Date {
  return new Date(`${key}T00:00:00Z`);
}

/** 上海零点的真实时刻；和 DateTime 列比较时用 */
export function keyToInstant(key: string): Date {
  return new Date(`${key}T00:00:00+08:00`);
}

export function addDays(key: string, n: number): string {
  return new Date(keyToDate(key).getTime() + n * DAY_MS).toISOString().slice(0, 10);
}

export function daysBetween(fromKey: string, toKey: string): number {
  return Math.round((keyToDate(toKey).getTime() - keyToDate(fromKey).getTime()) / DAY_MS);
}

export function weekStartKey(key: string): string {
  const dow = keyToDate(key).getUTCDay(); // 0 = 周日
  const back = (dow + 6) % 7;
  return addDays(key, -back);
}

export function computeStreak(keys: Set<string>, todayKey: string): number {
  let cursor = keys.has(todayKey) ? todayKey : addDays(todayKey, -1);
  let n = 0;
  while (keys.has(cursor)) {
    n += 1;
    cursor = addDays(cursor, -1);
  }
  return n;
}

export function dueLabel(nextReviewAt: Date, todayKey: string): string {
  const diff = daysBetween(todayKey, dateKey(nextReviewAt));
  if (diff < 0) return "已到期";
  if (diff === 0) return "今天";
  if (diff === 1) return "明天";
  return `${diff} 天后`;
}
```

- [ ] **Step 4: 运行，确认通过**

```bash
npx vitest run src/server/lib/dates.test.ts
```

期望：全部 PASS。

- [ ] **Step 5: 写 `src/server/lib/parse.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { parseDeadline, splitGradDegree, splitMulti } from "./parse";

describe("splitMulti", () => {
  it("顿号", () => {
    expect(splitMulti("北京、上海、杭州、东莞、海外")).toEqual(["北京", "上海", "杭州", "东莞", "海外"]);
  });
  it("空格", () => {
    expect(splitMulti("昆山 厦门 黄石 成都")).toEqual(["昆山", "厦门", "黄石", "成都"]);
  });
  it("斜杠", () => {
    expect(splitMulti("玩具/潮玩/文创设计")).toEqual(["玩具", "潮玩", "文创设计"]);
  });
  it("混用 + 去重 + trim", () => {
    expect(splitMulti(" 北京 ，上海、北京 | 深圳 ")).toEqual(["北京", "上海", "深圳"]);
  });
  it("空值", () => {
    expect(splitMulti("")).toEqual([]);
    expect(splitMulti(null)).toEqual([]);
    expect(splitMulti(undefined)).toEqual([]);
  });
});

describe("parseDeadline", () => {
  const today = "2026-09-12";
  it("带年份的各种写法", () => {
    expect(parseDeadline("2026.11.30", today)).toBe("2026-11-30");
    expect(parseDeadline("2026/11/30", today)).toBe("2026-11-30");
    expect(parseDeadline("2026-11-30", today)).toBe("2026-11-30");
    expect(parseDeadline("2026年11月30日", today)).toBe("2026-11-30");
    expect(parseDeadline("2026/9/8", today)).toBe("2026-09-08");
  });
  it("不带年份：默认当年", () => {
    expect(parseDeadline("11.30", today)).toBe("2026-11-30");
    expect(parseDeadline("11月30日", today)).toBe("2026-11-30");
  });
  it("不带年份且早于今天 180 天以上：视为次年", () => {
    expect(parseDeadline("1.15", today)).toBe("2027-01-15");
  });
  it("不带年份且在 180 天内的过去：仍是当年（刚过期）", () => {
    expect(parseDeadline("9.1", today)).toBe("2026-09-01");
  });
  it("解析不了的返回 null", () => {
    expect(parseDeadline("尽快投递，招满即止", today)).toBeNull();
    expect(parseDeadline("长期有效", today)).toBeNull();
    expect(parseDeadline("", today)).toBeNull();
    expect(parseDeadline(null, today)).toBeNull();
  });
  it("前后带说明文字也能提取", () => {
    expect(parseDeadline("截止 2026.11.30 前", today)).toBe("2026-11-30");
  });
});

describe("splitGradDegree", () => {
  it("换行分隔的届别 + 学历", () => {
    expect(splitGradDegree("2027届\n\n本科及以上")).toEqual({ graduationYear: "2027届", degree: "本科及以上" });
    expect(splitGradDegree("2026/2027届\n\n本科及以上")).toEqual({ graduationYear: "2026/2027届", degree: "本科及以上" });
  });
  it("只有一项", () => {
    expect(splitGradDegree("2027届")).toEqual({ graduationYear: "2027届", degree: null });
    expect(splitGradDegree("本科及以上")).toEqual({ graduationYear: null, degree: "本科及以上" });
    expect(splitGradDegree("硕士")).toEqual({ graduationYear: null, degree: "硕士" });
    expect(splitGradDegree("学历不限")).toEqual({ graduationYear: null, degree: "学历不限" });
  });
  it("空值", () => {
    expect(splitGradDegree("")).toEqual({ graduationYear: null, degree: null });
    expect(splitGradDegree(null)).toEqual({ graduationYear: null, degree: null });
  });
});
```

- [ ] **Step 6: 运行，确认失败**

```bash
npx vitest run src/server/lib/parse.test.ts
```

期望：FAIL，`Cannot find module './parse'`。

- [ ] **Step 7: 写 `src/server/lib/parse.ts`**

```ts
import { dateKey, daysBetween } from "./dates";

const SEPARATORS = /[、，,\/|\s]+/;

export function splitMulti(text: string | null | undefined): string[] {
  if (!text) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of text.split(SEPARATORS)) {
    const s = raw.trim();
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

function pad(n: string): string {
  return n.padStart(2, "0");
}

/** 返回 "YYYY-MM-DD" 或 null。todayKey 只在测试里传，生产用当天。 */
export function parseDeadline(text: string | null | undefined, todayKey: string = dateKey()): string | null {
  if (!text) return null;
  const s = text.trim();

  const withYear = s.match(/(\d{4})\s*[./\-年]\s*(\d{1,2})\s*[./\-月]\s*(\d{1,2})\s*日?/);
  if (withYear) {
    const [, y, m, d] = withYear;
    return `${y}-${pad(m)}-${pad(d)}`;
  }

  const noYear = s.match(/(?<!\d)(\d{1,2})\s*[./\-月]\s*(\d{1,2})\s*日?(?!\d)/);
  if (noYear) {
    const [, m, d] = noYear;
    const year = Number(todayKey.slice(0, 4));
    const candidate = `${year}-${pad(m)}-${pad(d)}`;
    if (daysBetween(candidate, todayKey) > 180) {
      return `${year + 1}-${pad(m)}-${pad(d)}`;
    }
    return candidate;
  }

  return null;
}

const DEGREE_HINT = /及以上|本科|硕士|博士|不限|大专|研究生/;

export function splitGradDegree(cell: string | null | undefined): { graduationYear: string | null; degree: string | null } {
  if (!cell) return { graduationYear: null, degree: null };
  let graduationYear: string | null = null;
  let degree: string | null = null;
  for (const raw of cell.split(/\r?\n/)) {
    const s = raw.trim();
    if (!s) continue;
    if (s.includes("届")) {
      graduationYear ??= s;
    } else if (DEGREE_HINT.test(s)) {
      degree ??= s;
    }
  }
  return { graduationYear, degree };
}
```

- [ ] **Step 8: 运行，确认通过**

```bash
npx vitest run src/server/lib/parse.test.ts
```

期望：全部 PASS。若 `"截止 2026.11.30 前"` 失败，检查 `withYear` 正则没有被锚定到行首。

- [ ] **Step 9: Commit**

```bash
git add src/server/lib
git commit -m "feat(server): 时区安全日期工具与 Excel 脏数据清洗函数（含测试）"
```

---

### Task 3: HTTP 壳、当前用户、种子账号、`/api/me`

**Files:**
- Create: `src/server/lib/http.ts`, `src/server/auth.ts`, `src/server/services/users.ts`, `prisma/seed.ts`, `src/app/api/me/route.ts`

**Interfaces:**
- Produces:
  - `class NotFoundError extends Error`
  - `json(data: unknown, init?: ResponseInit): Response`
  - `noContent(): Response`
  - `handle(fn: () => Promise<Response>): Promise<Response>` — ZodError→400，NotFoundError→404，其余→500
  - `readJson<T>(req: Request, schema: ZodType<T>): Promise<T>`
  - `readQuery<T>(req: Request, schema: ZodType<T>): T`
  - `getCurrentUserId(): Promise<string>`
  - `getCurrentUser(): Promise<{ id: string; email: string; name: string }>`
  - 种子常量 `DEV_USER_EMAIL = "dev@local"`

- [ ] **Step 1: 写 `src/server/lib/http.ts`**

```ts
import { ZodError, type ZodType } from "zod";

export class NotFoundError extends Error {
  constructor(message = "not found") {
    super(message);
    this.name = "NotFoundError";
  }
}

export function json(data: unknown, init?: ResponseInit): Response {
  return Response.json(data, init);
}

export function noContent(): Response {
  return new Response(null, { status: 204 });
}

export async function readJson<T>(req: Request, schema: ZodType<T>): Promise<T> {
  const body = await req.json().catch(() => {
    throw new ZodError([{ code: "custom", path: [], message: "请求体不是合法 JSON", input: undefined }]);
  });
  return schema.parse(body);
}

export function readQuery<T>(req: Request, schema: ZodType<T>): T {
  const params = Object.fromEntries(new URL(req.url).searchParams);
  return schema.parse(params);
}

export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof ZodError) {
      return json({ error: { code: "VALIDATION", message: "参数校验失败", issues: err.issues } }, { status: 400 });
    }
    if (err instanceof NotFoundError) {
      return json({ error: { code: "NOT_FOUND", message: err.message } }, { status: 404 });
    }
    console.error(err);
    return json({ error: { code: "INTERNAL", message: "服务器内部错误" } }, { status: 500 });
  }
}
```

- [ ] **Step 2: 写 `src/server/auth.ts`**

```ts
import "server-only";
import { cache } from "react";
import { prisma } from "./db";

export const DEV_USER_EMAIL = "dev@local";

/**
 * 当前用户 id。现在固定返回种子开发账号；接入登录时只改这个函数。
 * React.cache：同一次请求内多处调用只查一次库。
 */
export const getCurrentUserId = cache(async (): Promise<string> => {
  const user = await prisma.user.findUnique({ where: { email: DEV_USER_EMAIL }, select: { id: true } });
  if (!user) throw new Error(`种子用户 ${DEV_USER_EMAIL} 不存在，先运行 npm run db:seed`);
  return user.id;
});
```

- [ ] **Step 3: 写 `src/server/services/users.ts`**

```ts
import "server-only";
import { prisma } from "@/server/db";
import { getCurrentUserId } from "@/server/auth";

export async function getCurrentUser(): Promise<{ id: string; email: string; name: string }> {
  const id = await getCurrentUserId();
  const user = await prisma.user.findUniqueOrThrow({ where: { id }, select: { id: true, email: true, name: true } });
  return user;
}
```

- [ ] **Step 4: 写 `prisma/seed.ts`（先只放用户；题库在 Task 8 追加）**

```ts
import "dotenv/config";
import { prisma } from "../src/server/db";

const DEV_USER_EMAIL = "dev@local";

async function seedUser() {
  await prisma.user.upsert({
    where: { email: DEV_USER_EMAIL },
    update: {},
    create: { email: DEV_USER_EMAIL, name: "开发账号" },
  });
  console.log(`用户 ${DEV_USER_EMAIL} 就绪`);
}

async function main() {
  await seedUser();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 5: 跑种子**

```bash
npm run db:seed
```

期望：打印 `用户 dev@local 就绪`。

- [ ] **Step 6: 写 `src/app/api/me/route.ts`**

```ts
import { handle, json } from "@/server/lib/http";
import { getCurrentUser } from "@/server/services/users";

export async function GET() {
  return handle(async () => json(await getCurrentUser()));
}
```

- [ ] **Step 7: 验证**

```bash
curl -s localhost:3000/api/me
```

期望：`{"id":"...","email":"dev@local","name":"开发账号"}`。

- [ ] **Step 8: Commit**

```bash
git add src/server prisma/seed.ts src/app/api/me
git commit -m "feat(api): HTTP 壳、当前用户接缝、种子账号与 /api/me"
```

---

### Task 4: 岗位实体的共享类型、分类映射与查询 schema

**Files:**
- Create: `src/entities/job/model/category.ts`, `src/entities/job/model/query.ts`
- Modify: `src/entities/job/model/types.ts`（整体替换）, `src/entities/job/index.ts`（整体替换）
- Delete: `src/entities/job/model/data.ts`, `src/entities/job/lib/presentation.ts`

**Interfaces:**
- Produces:
  - `CATEGORY: Record<1|2|3, string>`, `type CategoryId = 1 | 2 | 3`, `CATEGORY_OPTIONS: { value: "all"|"1"|"2"|"3"; label: string }[]`
  - `jobListQuerySchema`（zod）与 `type JobListQuery`
  - `type JobListItem`, `type JobListResult`, `type JobProgress`, `type ApplicationStatus = "APPLIED" | "INTERVIEWING"`
  - `statusLabel(s: ApplicationStatus | null, expired: boolean): string`
  - `statusVariant(s: ApplicationStatus | null, expired: boolean): "accent" | "neutral" | "outline"`

> 删除 `data.ts` 与 `presentation.ts` 后，`src/widgets/job-table/JobTable.tsx` 与 `src/views/job-board/JobBoardPage.tsx` 会暂时编译失败，Task 7 修复。这一任务的验收只跑 vitest。

- [ ] **Step 1: 写 `src/entities/job/model/category.ts`**

```ts
export type CategoryId = 1 | 2 | 3;

export const CATEGORY: Record<CategoryId, string> = {
  1: "秋招与实习",
  2: "央国企",
  3: "外企",
};

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

- [ ] **Step 2: 写 `src/entities/job/model/query.ts`**

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

/** 把 URL searchParams（值可能是 string[]）压成 schema 能吃的形状；"all" 与空串视为未设置 */
export function parseJobListQuery(raw: Record<string, string | string[] | undefined>): JobListQuery {
  const flat: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    const s = Array.isArray(v) ? v[0] : v;
    if (s === undefined || s === "" || s === "all") continue;
    flat[k] = s;
  }
  const r = jobListQuerySchema.safeParse(flat);
  return r.success ? r.data : jobListQuerySchema.parse({});
}
```

- [ ] **Step 3: 整体替换 `src/entities/job/model/types.ts`**

```ts
import type { CategoryId } from "./category";

export type ApplicationStatus = "APPLIED" | "INTERVIEWING";

export interface JobListItem {
  id: number;
  company: string;
  category: CategoryId;
  categoryLabel: string;
  positions: string[];
  cities: string[];
  degree: string | null;
  industry: string | null;
  batch: string | null;
  graduationYear: string | null;
  deadlineText: string | null;
  deadlineAt: string | null;
  daysLeft: number | null;
  postedAt: string;
  announcementLink: string | null;
  deliveryAddress: string | null;
  starred: boolean;
  applicationStatus: ApplicationStatus | null;
}

export interface JobListResult {
  items: JobListItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface JobProgress {
  starred: number;
  applied: number;
  interviewing: number;
  newThisWeek: number;
  newInternshipsThisWeek: number;
  nextDeadline: { jobId: number; company: string; daysLeft: number } | null;
}

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

- [ ] **Step 4: 整体替换 `src/entities/job/index.ts`**

```ts
export type { ApplicationStatus, JobListItem, JobListResult, JobProgress } from "./model/types";
export { isExpired, statusLabel, statusVariant } from "./model/types";
export type { CategoryId } from "./model/category";
export { CATEGORY, CATEGORY_OPTIONS, isCategoryId } from "./model/category";
export type { JobListQuery } from "./model/query";
export { jobListQuerySchema, parseJobListQuery } from "./model/query";
```

- [ ] **Step 5: 删除旧文件**

```bash
rm src/entities/job/model/data.ts src/entities/job/lib/presentation.ts
rmdir src/entities/job/lib
```

- [ ] **Step 6: 验证（只跑 vitest；tsc 此时会因页面引用旧类型而失败，属预期）**

```bash
npm test
```

期望：Task 2 的测试仍全部 PASS。

- [ ] **Step 7: Commit**

```bash
git add -A src/entities/job
git commit -m "refactor(entities): 岗位实体改为 DTO 类型 + 分类映射 + 查询 schema"
```

---

### Task 5: 岗位服务层（DTO 映射纯函数 TDD + Prisma 查询）

**Files:**
- Create: `src/server/lib/job-dto.ts`, `src/server/lib/job-dto.test.ts`, `src/server/services/jobs.ts`

**Interfaces:**
- Consumes: `prisma`；`dateKey/daysBetween/weekStartKey/keyToInstant/keyToDate`；`splitMulti`；`CATEGORY/isCategoryId`；`JobListQuery/JobListItem/JobListResult/JobProgress`
- Produces:
  - `toJobListItem(row: JobRowWithUserState, todayKey: string): JobListItem`（纯）
  - `type JobRowWithUserState = Job & { favorites: { userId: string }[]; applications: { status: AppStatus }[] }`
  - `listJobs(query: JobListQuery, userId: string): Promise<JobListResult>`
  - `setFavorite(jobId: number, userId: string, starred: boolean): Promise<{ starred: boolean }>`
  - `setApplication(jobId: number, userId: string, status: AppStatus | null): Promise<{ applicationStatus: AppStatus | null }>`
  - `getProgress(userId: string): Promise<JobProgress>`

- [ ] **Step 1: 写 `src/server/lib/job-dto.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { toJobListItem, type JobRowWithUserState } from "./job-dto";

const base: JobRowWithUserState = {
  id: 7,
  serialNumber: null,
  categoryId: 1,
  recruitmentBatch: "秋招",
  enterpriseNature: "民营企业",
  industry: "玩具/潮玩/文创设计",
  workLocation: "北京、上海、杭州",
  position: "商业分析、商品分析、主播运营",
  enterpriseName: "泡泡玛特",
  graduationYear: "2027届",
  degree: "本科及以上",
  announcementLink: "https://example.com/a",
  deliveryAddress: "https://example.com/apply",
  deadline: "2026.11.30",
  deadlineAt: new Date("2026-11-30T00:00:00Z"),
  createTime: new Date("2026-09-08T01:00:00Z"),
  updateTime: new Date("2026-09-08T01:00:00Z"),
  favorites: [],
  applications: [],
};

describe("toJobListItem", () => {
  it("拆分多值字段、算剩余天数、映射分类", () => {
    const item = toJobListItem(base, "2026-09-12");
    expect(item.company).toBe("泡泡玛特");
    expect(item.categoryLabel).toBe("秋招与实习");
    expect(item.positions).toEqual(["商业分析", "商品分析", "主播运营"]);
    expect(item.cities).toEqual(["北京", "上海", "杭州"]);
    expect(item.deadlineAt).toBe("2026-11-30");
    expect(item.daysLeft).toBe(79);
    expect(item.postedAt).toBe("2026-09-08");
    expect(item.starred).toBe(false);
    expect(item.applicationStatus).toBeNull();
  });

  it("无法解析的截止日期：deadlineAt/daysLeft 为 null，原文保留", () => {
    const item = toJobListItem({ ...base, deadline: "尽快投递，招满即止", deadlineAt: null }, "2026-09-12");
    expect(item.deadlineText).toBe("尽快投递，招满即止");
    expect(item.deadlineAt).toBeNull();
    expect(item.daysLeft).toBeNull();
  });

  it("已过期为负数", () => {
    const item = toJobListItem({ ...base, deadlineAt: new Date("2026-09-10T00:00:00Z") }, "2026-09-12");
    expect(item.daysLeft).toBe(-2);
  });

  it("带用户状态", () => {
    const item = toJobListItem(
      { ...base, favorites: [{ userId: "u1" }], applications: [{ status: "INTERVIEWING" }] },
      "2026-09-12",
    );
    expect(item.starred).toBe(true);
    expect(item.applicationStatus).toBe("INTERVIEWING");
  });
});
```

- [ ] **Step 2: 运行，确认失败**

```bash
npx vitest run src/server/lib/job-dto.test.ts
```

期望：FAIL，`Cannot find module './job-dto'`。

- [ ] **Step 3: 写 `src/server/lib/job-dto.ts`**

```ts
import type { Job } from "@/generated/prisma/client";
import type { AppStatus } from "@/generated/prisma/enums";
import { CATEGORY, isCategoryId, type JobListItem } from "@entities/job";
import { dateKey, daysBetween } from "./dates";
import { splitMulti } from "./parse";

export type JobRowWithUserState = Job & {
  favorites: { userId: string }[];
  applications: { status: AppStatus }[];
};

export function toJobListItem(row: JobRowWithUserState, todayKey: string): JobListItem {
  const category = isCategoryId(row.categoryId) ? row.categoryId : 1;
  const deadlineAt = row.deadlineAt ? row.deadlineAt.toISOString().slice(0, 10) : null;
  return {
    id: row.id,
    company: row.enterpriseName,
    category,
    categoryLabel: CATEGORY[category],
    positions: splitMulti(row.position),
    cities: splitMulti(row.workLocation),
    degree: row.degree,
    industry: row.industry,
    batch: row.recruitmentBatch,
    graduationYear: row.graduationYear,
    deadlineText: row.deadline,
    deadlineAt,
    daysLeft: deadlineAt ? daysBetween(todayKey, deadlineAt) : null,
    postedAt: dateKey(row.createTime),
    announcementLink: row.announcementLink,
    deliveryAddress: row.deliveryAddress,
    starred: row.favorites.length > 0,
    applicationStatus: row.applications[0]?.status ?? null,
  };
}
```

- [ ] **Step 4: 运行，确认通过**

```bash
npx vitest run src/server/lib/job-dto.test.ts
```

期望：全部 PASS。

- [ ] **Step 5: 写 `src/server/services/jobs.ts`**

```ts
import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { AppStatus } from "@/generated/prisma/enums";
import { prisma } from "@/server/db";
import { NotFoundError } from "@/server/lib/http";
import { dateKey, daysBetween, keyToDate, keyToInstant, weekStartKey } from "@/server/lib/dates";
import { toJobListItem } from "@/server/lib/job-dto";
import type { JobListQuery, JobListResult, JobProgress } from "@entities/job";

const userState = (userId: string) => ({
  favorites: { where: { userId }, select: { userId: true } },
  applications: { where: { userId }, select: { status: true } },
});

export async function listJobs(query: JobListQuery, userId: string): Promise<JobListResult> {
  const where: Prisma.JobWhereInput = {
    ...(query.category && { categoryId: query.category }),
    ...(query.city && { workLocation: { contains: query.city } }),
    ...(query.q && {
      OR: [
        { enterpriseName: { contains: query.q, mode: "insensitive" } },
        { position: { contains: query.q, mode: "insensitive" } },
        { industry: { contains: query.q, mode: "insensitive" } },
      ],
    }),
  };

  const orderBy: Prisma.JobOrderByWithRelationInput[] =
    query.sort === "posted"
      ? [{ createTime: "desc" }]
      : [{ deadlineAt: { sort: "asc", nulls: "last" } }, { createTime: "desc" }];

  const [rows, total] = await Promise.all([
    prisma.job.findMany({
      where,
      orderBy,
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include: userState(userId),
    }),
    prisma.job.count({ where }),
  ]);

  const today = dateKey();
  return {
    items: rows.map((r) => toJobListItem(r, today)),
    total,
    page: query.page,
    pageSize: query.pageSize,
  };
}

async function assertJobExists(jobId: number) {
  const exists = await prisma.job.findUnique({ where: { id: jobId }, select: { id: true } });
  if (!exists) throw new NotFoundError(`岗位 ${jobId} 不存在`);
}

export async function setFavorite(jobId: number, userId: string, starred: boolean): Promise<{ starred: boolean }> {
  await assertJobExists(jobId);
  if (starred) {
    await prisma.favorite.upsert({
      where: { userId_jobId: { userId, jobId } },
      update: {},
      create: { userId, jobId },
    });
  } else {
    await prisma.favorite.deleteMany({ where: { userId, jobId } });
  }
  return { starred };
}

export async function setApplication(
  jobId: number,
  userId: string,
  status: AppStatus | null,
): Promise<{ applicationStatus: AppStatus | null }> {
  await assertJobExists(jobId);
  if (status) {
    await prisma.application.upsert({
      where: { userId_jobId: { userId, jobId } },
      update: { status },
      create: { userId, jobId, status },
    });
  } else {
    await prisma.application.deleteMany({ where: { userId, jobId } });
  }
  return { applicationStatus: status };
}

export async function getProgress(userId: string): Promise<JobProgress> {
  const today = dateKey();
  const weekStart = keyToInstant(weekStartKey(today));

  const [starred, applied, interviewing, newThisWeek, newInternshipsThisWeek, next] = await Promise.all([
    prisma.favorite.count({ where: { userId } }),
    prisma.application.count({ where: { userId, status: "APPLIED" } }),
    prisma.application.count({ where: { userId, status: "INTERVIEWING" } }),
    prisma.job.count({ where: { createTime: { gte: weekStart } } }),
    prisma.job.count({ where: { createTime: { gte: weekStart }, recruitmentBatch: { contains: "实习" } } }),
    prisma.favorite.findFirst({
      where: { userId, job: { deadlineAt: { gte: keyToDate(today) } } },
      orderBy: { job: { deadlineAt: "asc" } },
      select: { job: { select: { id: true, enterpriseName: true, deadlineAt: true } } },
    }),
  ]);

  return {
    starred,
    applied,
    interviewing,
    newThisWeek,
    newInternshipsThisWeek,
    nextDeadline: next?.job.deadlineAt
      ? {
          jobId: next.job.id,
          company: next.job.enterpriseName,
          daysLeft: daysBetween(today, next.job.deadlineAt.toISOString().slice(0, 10)),
        }
      : null,
  };
}
```

- [ ] **Step 6: 类型检查这几个文件**

```bash
npx tsc --noEmit 2>&1 | grep -E "src/server" || echo "server 目录无类型错误"
```

期望：`server 目录无类型错误`（其他目录的错误留到 Task 7）。

- [ ] **Step 7: Commit**

```bash
git add src/server/lib/job-dto.ts src/server/lib/job-dto.test.ts src/server/services/jobs.ts
git commit -m "feat(server): 岗位服务层 —— 列表/收藏/投递/进度"
```

---

### Task 6: 岗位 REST 路由

**Files:**
- Create: `src/app/api/jobs/route.ts`, `src/app/api/jobs/[id]/favorite/route.ts`, `src/app/api/jobs/[id]/application/route.ts`

**Interfaces:**
- Consumes: `handle/json/readJson/readQuery`；`getCurrentUserId`；`listJobs/setFavorite/setApplication`；`jobListQuerySchema`

- [ ] **Step 1: 写 `src/app/api/jobs/route.ts`**

```ts
import { handle, json, readQuery } from "@/server/lib/http";
import { getCurrentUserId } from "@/server/auth";
import { listJobs } from "@/server/services/jobs";
import { jobListQuerySchema } from "@entities/job";

export async function GET(req: Request) {
  return handle(async () => {
    const query = readQuery(req, jobListQuerySchema);
    const userId = await getCurrentUserId();
    return json(await listJobs(query, userId));
  });
}
```

- [ ] **Step 2: 写 `src/app/api/jobs/[id]/favorite/route.ts`**

```ts
import { z } from "zod";
import { handle, json } from "@/server/lib/http";
import { getCurrentUserId } from "@/server/auth";
import { setFavorite } from "@/server/services/jobs";

const idSchema = z.coerce.number().int().positive();

export async function PUT(_req: Request, ctx: RouteContext<"/api/jobs/[id]/favorite">) {
  return handle(async () => {
    const jobId = idSchema.parse((await ctx.params).id);
    const userId = await getCurrentUserId();
    return json(await setFavorite(jobId, userId, true));
  });
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/jobs/[id]/favorite">) {
  return handle(async () => {
    const jobId = idSchema.parse((await ctx.params).id);
    const userId = await getCurrentUserId();
    return json(await setFavorite(jobId, userId, false));
  });
}
```

- [ ] **Step 3: 写 `src/app/api/jobs/[id]/application/route.ts`**

```ts
import { z } from "zod";
import { handle, json, readJson } from "@/server/lib/http";
import { getCurrentUserId } from "@/server/auth";
import { setApplication } from "@/server/services/jobs";

const idSchema = z.coerce.number().int().positive();
const bodySchema = z.object({ status: z.enum(["APPLIED", "INTERVIEWING"]) });

export async function PUT(req: Request, ctx: RouteContext<"/api/jobs/[id]/application">) {
  return handle(async () => {
    const jobId = idSchema.parse((await ctx.params).id);
    const { status } = await readJson(req, bodySchema);
    const userId = await getCurrentUserId();
    return json(await setApplication(jobId, userId, status));
  });
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/jobs/[id]/application">) {
  return handle(async () => {
    const jobId = idSchema.parse((await ctx.params).id);
    const userId = await getCurrentUserId();
    return json(await setApplication(jobId, userId, null));
  });
}
```

- [ ] **Step 4: 手工插入一条岗位用于验证（导入脚本在 Task 9）**

```bash
npx prisma db execute --stdin <<'SQL'
INSERT INTO "Job" ("categoryId","recruitmentBatch","enterpriseNature","industry","workLocation","position","enterpriseName","graduationYear","degree","announcementLink","deliveryAddress","deadline","deadlineAt","updateTime")
VALUES (1,'秋招','民营企业','玩具/潮玩','北京、上海','商业分析、商品分析','泡泡玛特','2027届','本科及以上','https://example.com/a','https://example.com/apply','2026.11.30','2026-11-30',now());
SQL
```

- [ ] **Step 5: 验证**

```bash
curl -s 'localhost:3000/api/jobs?category=1&sort=deadline' | jq '.total, .items[0].company, .items[0].positions, .items[0].daysLeft'
curl -s -X PUT localhost:3000/api/jobs/1/favorite
curl -s 'localhost:3000/api/jobs' | jq '.items[0].starred'
curl -s -X PUT localhost:3000/api/jobs/1/application -H 'content-type: application/json' -d '{"status":"APPLIED"}'
curl -s -X DELETE localhost:3000/api/jobs/1/favorite
curl -s -o /dev/null -w '%{http_code}\n' 'localhost:3000/api/jobs?page=abc'
curl -s -o /dev/null -w '%{http_code}\n' -X PUT localhost:3000/api/jobs/999999/favorite
```

期望依次：`1 "泡泡玛特" ["商业分析","商品分析"] <正整数>`；`{"starred":true}`；`true`；`{"applicationStatus":"APPLIED"}`；`{"starred":false}`；`400`；`404`。

- [ ] **Step 6: Commit**

```bash
git add src/app/api/jobs
git commit -m "feat(api): 岗位列表 / 收藏 / 投递状态 REST 路由"
```

---

### Task 7: 岗位看板接入真实数据 —— 页面、筛选栏、URL 状态

**Files:**
- Modify: `src/app/page.tsx`（整体替换）, `src/views/job-board/JobBoardPage.tsx`（整体替换）, `src/features/job-filters/JobFilters.tsx`（整体替换）, `src/widgets/progress-card/ProgressCard.tsx`（整体替换）

**Interfaces:**
- Consumes: `listJobs/getProgress`；`parseJobListQuery`；`JobListResult/JobProgress/JobListQuery`；`CATEGORY_OPTIONS`
- Produces: `JobBoardPage({ query, result, progress })`；`JobFilters` 受控 props（见代码）；`ProgressCard({ progress })`

> Task 7 结束后 `JobTable` 仍引用旧类型，页面暂时编译失败；Task 8 修 JobTable 后整体可跑。两个任务合起来验收。

- [ ] **Step 1: 整体替换 `src/app/page.tsx`**

```tsx
import { connection } from "next/server";
import { getCurrentUserId } from "@/server/auth";
import { getProgress, listJobs } from "@/server/services/jobs";
import { parseJobListQuery } from "@entities/job";
import { JobBoardPage } from "@pages/job-board/JobBoardPage";

export default async function Home({ searchParams }: PageProps<"/">) {
  await connection();
  const query = parseJobListQuery(await searchParams);
  const userId = await getCurrentUserId();
  const [result, progress] = await Promise.all([listJobs(query, userId), getProgress(userId)]);
  return <JobBoardPage query={query} result={result} progress={progress} />;
}
```

- [ ] **Step 2: 整体替换 `src/widgets/progress-card/ProgressCard.tsx`**

```tsx
import { BlueprintCard } from "@shared/ui/BlueprintCard";
import type { JobProgress } from "@entities/job";

interface ProgressCardProps {
  progress: JobProgress;
}

export function ProgressCard({ progress }: ProgressCardProps) {
  const stats = [
    { value: progress.starred, label: "已收藏" },
    { value: progress.applied, label: "已投递" },
    { value: progress.interviewing, label: "面试中" },
  ];

  return (
    <BlueprintCard className="px-5 py-[18px]">
      <p className="text-[10px] uppercase tracking-[0.1em] text-accent">我的进度</p>

      <div className="mt-3.5 grid grid-cols-3 gap-3">
        {stats.map((s) => (
          <div key={s.label}>
            <div className="font-heading text-3xl leading-none tabular-nums">{s.value}</div>
            <div className="mt-1 text-[11px] text-neutral-700">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="my-3 h-px bg-divider" />

      <div className="flex items-center justify-between gap-2 text-xs text-neutral-700">
        {progress.nextDeadline ? (
          <>
            <span className="truncate">下一个截止：{progress.nextDeadline.company}</span>
            <span className="shrink-0 tabular-nums text-accent-800">{progress.nextDeadline.daysLeft} 天</span>
          </>
        ) : (
          <span>收藏岗位后这里会提醒最近的截止</span>
        )}
      </div>
    </BlueprintCard>
  );
}
```

- [ ] **Step 3: 整体替换 `src/features/job-filters/JobFilters.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import { Segmented } from "@shared/ui/Segmented";
import { Button } from "@shared/ui/Button";
import { Input } from "@shared/ui/Input";
import { cn } from "@shared/lib/cn";
import { CATEGORY_OPTIONS } from "@entities/job";

export type CategoryFilter = "all" | "1" | "2" | "3";
export type SortOrder = "deadline" | "posted";

export const CITY_CHIPS = ["全部", "北京", "上海", "深圳", "杭州", "广州"] as const;

interface JobFiltersProps {
  query: string;
  onQueryChange: (value: string) => void;
  category: CategoryFilter;
  onCategoryChange: (value: CategoryFilter) => void;
  city: string;
  onCityChange: (value: string) => void;
  sort: SortOrder;
  onSortChange: (value: SortOrder) => void;
  onExport: () => void;
}

export function JobFilters({
  query,
  onQueryChange,
  category,
  onCategoryChange,
  city,
  onCityChange,
  sort,
  onSortChange,
  onExport,
}: JobFiltersProps) {
  // 搜索框本地缓冲 + 300ms 防抖，避免每个字符都改 URL
  const [draft, setDraft] = useState(query);
  useEffect(() => setDraft(query), [query]);
  useEffect(() => {
    if (draft === query) return;
    const t = setTimeout(() => onQueryChange(draft), 300);
    return () => clearTimeout(t);
  }, [draft, query, onQueryChange]);

  return (
    <div className="flex flex-col gap-3 border-b border-divider px-4 py-4 sm:px-8 lg:flex-row lg:flex-wrap lg:items-center lg:gap-3.5">
      <Input
        placeholder="搜索公司、岗位或行业"
        className="lg:w-[230px]"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
      />

      <div className="flex flex-wrap items-center gap-3">
        <Segmented
          name="category-filter"
          value={category}
          onChange={onCategoryChange}
          options={CATEGORY_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
        />

        <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
          {CITY_CHIPS.map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={c === city}
              onClick={() => onCityChange(c)}
              className={cn(
                "shrink-0 cursor-pointer rounded-[3px] px-3 py-1.5 text-xs transition-colors",
                c === city ? "bg-accent-100 text-accent-800" : "border border-accent text-accent hover:bg-accent/10",
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="hidden flex-1 lg:block" />

      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[13px] text-neutral-700">排序</span>
        <Segmented
          name="sort-order"
          value={sort}
          onChange={onSortChange}
          options={[
            { value: "deadline", label: "截止最近" },
            { value: "posted", label: "最新发布" },
          ]}
        />
        <Button onClick={onExport}>导出列表</Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: 整体替换 `src/views/job-board/JobBoardPage.tsx`**

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@widgets/navbar/Navbar";
import { ProgressCard } from "@widgets/progress-card/ProgressCard";
import { JobTable } from "@widgets/job-table/JobTable";
import { JobFilters, type CategoryFilter, type SortOrder } from "@features/job-filters/JobFilters";
import { Button } from "@shared/ui/Button";
import { Input } from "@shared/ui/Input";
import { Tag } from "@shared/ui/Tag";
import { Kicker } from "@shared/ui/Kicker";
import type { ApplicationStatus, CategoryId, JobListItem, JobListQuery, JobListResult, JobProgress } from "@entities/job";

interface JobBoardPageProps {
  query: JobListQuery;
  result: JobListResult;
  progress: JobProgress;
}

/** navigate() 接受的局部更新；city 传 "全部" 表示清除 */
type NavPatch = Partial<Omit<JobListQuery, "category">> & { category?: CategoryId };

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

function buildHref(next: NavPatch): string {
  const sp = new URLSearchParams();
  if (next.category) sp.set("category", String(next.category));
  if (next.city && next.city !== "全部") sp.set("city", next.city);
  if (next.q) sp.set("q", next.q);
  if (next.sort && next.sort !== "deadline") sp.set("sort", next.sort);
  if (next.page && next.page > 1) sp.set("page", String(next.page));
  const qs = sp.toString();
  return qs ? `/?${qs}` : "/";
}

export function JobBoardPage({ query, result, progress }: JobBoardPageProps) {
  const router = useRouter();

  const [items, setItems] = useState(result.items);
  useEffect(() => setItems(result.items), [result.items]);

  const navigate = useCallback(
    (patch: NavPatch) => {
      router.replace(buildHref({ ...query, page: 1, ...patch }));
    },
    [router, query],
  );

  const patchItem = (id: number, patch: Partial<JobListItem>) =>
    setItems((prev) => prev.map((j) => (j.id === id ? { ...j, ...patch } : j)));

  async function toggleStar(id: number) {
    const before = items.find((j) => j.id === id);
    if (!before) return;
    const starred = !before.starred;
    patchItem(id, { starred });
    const res = await fetch(`/api/jobs/${id}/favorite`, { method: starred ? "PUT" : "DELETE" });
    if (!res.ok) {
      patchItem(id, { starred: before.starred });
      console.error("收藏失败", await res.text());
    }
  }

  async function markApplied(id: number) {
    const before = items.find((j) => j.id === id);
    if (!before) return;
    const status: ApplicationStatus = "APPLIED";
    patchItem(id, { applicationStatus: status });
    const res = await fetch(`/api/jobs/${id}/application`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      patchItem(id, { applicationStatus: before.applicationStatus });
      console.error("标记失败", await res.text());
    }
  }

  function handleExport() {
    const blob = new Blob([toCsv(items)], { type: "text/csv;charset=utf-8;" });
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
              navigate({ q: typeof q === "string" ? q.trim() : "" });
            }}
          >
            <Input name="q" placeholder="搜索公司、岗位或行业" className="min-h-10 sm:flex-1" defaultValue={query.q ?? ""} />
            <Button type="submit" variant="primary" size="lg" blueprint className="min-h-10 px-6">
              检索
            </Button>
          </form>
        </div>
        <ProgressCard progress={progress} />
      </section>

      <div className="flex flex-col gap-2 border-b border-divider bg-accent-100 px-4 py-3 sm:flex-row sm:items-center sm:gap-3.5 sm:px-8">
        <Tag variant="solid" className="self-start">本周新增</Tag>
        <p className="text-sm">
          新上 <b className="tabular-nums">{progress.newThisWeek}</b> 条公告，其中实习{" "}
          <b className="tabular-nums">{progress.newInternshipsThisWeek}</b> 条
        </p>
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => navigate({ sort: "posted", city: "全部", category: undefined })}
          className="cursor-pointer self-start text-[13px] text-accent-700 hover:text-accent-900 sm:self-auto"
        >
          只看本周新增 →
        </button>
      </div>

      <JobFilters
        query={query.q ?? ""}
        onQueryChange={(q) => navigate({ q })}
        category={(query.category ? String(query.category) : "all") as CategoryFilter}
        onCategoryChange={(c) => navigate({ category: c === "all" ? undefined : (Number(c) as CategoryId) })}
        city={query.city ?? "全部"}
        onCityChange={(city) => navigate({ city })}
        sort={query.sort}
        onSortChange={(sort: SortOrder) => navigate({ sort })}
        onExport={handleExport}
      />

      <JobTable jobs={items} onToggleStar={toggleStar} onMarkApplied={markApplied} />

      <div className="flex flex-col items-center justify-between gap-3 px-4 pb-10 pt-5 sm:flex-row sm:px-8">
        <span className="text-xs tabular-nums text-neutral-700">
          显示 {from}–{to}，共 <b>{result.total}</b> 条
        </span>
        <div className="flex items-center gap-1.5">
          <Button disabled={result.page <= 1} onClick={() => navigate({ page: result.page - 1 })}>
            上一页
          </Button>
          <Button variant="primary" disabled className="min-w-9 tabular-nums">
            {result.page} / {totalPages}
          </Button>
          <Button disabled={result.page >= totalPages} onClick={() => navigate({ page: result.page + 1 })}>
            下一页
          </Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Commit（编译尚未通过，Task 8 后一起验收）**

```bash
git add src/app/page.tsx src/views/job-board src/features/job-filters src/widgets/progress-card
git commit -m "feat(job-board): 页面改为服务端取数 + URL 筛选状态 + 乐观更新"
```

---

### Task 8: 岗位表格适配新 DTO —— 多岗位、多城市、真实链接

**Files:**
- Modify: `src/widgets/job-table/JobTable.tsx`（整体替换）

**Interfaces:**
- Consumes: `JobListItem`，`isExpired/statusLabel/statusVariant`
- Produces: `JobTable({ jobs, onToggleStar, onMarkApplied })`

- [ ] **Step 1: 整体替换 `src/widgets/job-table/JobTable.tsx`**

```tsx
"use client";

import { useState, type ReactNode } from "react";
import type { JobListItem } from "@entities/job";
import { isExpired, statusLabel, statusVariant } from "@entities/job";
import { Button } from "@shared/ui/Button";
import { Tag } from "@shared/ui/Tag";
import { DataTable, type Column } from "@shared/ui/DataTable";
import { cn } from "@shared/lib/cn";

interface JobTableProps {
  jobs: JobListItem[];
  onToggleStar: (id: number) => void;
  onMarkApplied: (id: number) => void;
}

function StarButton({ starred, onClick, className }: { starred: boolean; onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      aria-pressed={starred}
      aria-label={starred ? "取消收藏" : "收藏"}
      onClick={onClick}
      className={cn(
        "cursor-pointer border-none bg-transparent p-0 text-[15px] leading-none",
        starred ? "text-accent" : "text-neutral-400 hover:text-neutral-600",
        className,
      )}
    >
      {starred ? "★" : "☆"}
    </button>
  );
}

/** 前 3 个岗位 + "等 N 个"，点击展开 */
function Positions({ positions, className }: { positions: string[]; className?: string }) {
  const [open, setOpen] = useState(false);
  const shown = open ? positions : positions.slice(0, 3);
  const rest = positions.length - 3;
  return (
    <span className={cn("leading-snug", className)}>
      {shown.join("、")}
      {!open && rest > 0 && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="ml-1.5 cursor-pointer text-xs text-accent-700 hover:text-accent-900"
        >
          等 {positions.length} 个
        </button>
      )}
    </span>
  );
}

function DeadlineCell({ job }: { job: JobListItem }) {
  if (job.deadlineAt === null || job.daysLeft === null) {
    return <span className="text-[13px] text-neutral-700">{job.deadlineText ?? "—"}</span>;
  }
  const expired = job.daysLeft < 0;
  return (
    <span className="whitespace-nowrap">
      <span className="tabular-nums">{job.deadlineAt.slice(5)}</span>
      <span className={cn("ml-1.5 text-[11px] tabular-nums", !expired && job.daysLeft <= 10 ? "text-accent-800" : "text-neutral-700")}>
        {expired ? "已截止" : `剩 ${job.daysLeft} 天`}
      </span>
    </span>
  );
}

function ActionButton({ job, onMarkApplied }: { job: JobListItem; onMarkApplied: (id: number) => void }) {
  const applied = job.applicationStatus !== null;
  return (
    <Button size="sm" disabled={applied || isExpired(job)} onClick={() => onMarkApplied(job.id)}>
      {applied ? "已投递" : "标记已投"}
    </Button>
  );
}

function ExternalLink({ href, children }: { href: string | null; children: ReactNode }) {
  if (!href) return <span className="text-[13px] text-neutral-500">—</span>;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-[13px] text-accent-700 hover:text-accent-900">
      {children}
    </a>
  );
}

export function JobTable({ jobs, onToggleStar, onMarkApplied }: JobTableProps) {
  const columns: Column<JobListItem>[] = [
    { id: "star", header: "收藏", headerSrOnly: true, width: "3%", cell: (j) => <StarButton starred={j.starred} onClick={() => onToggleStar(j.id)} /> },
    { id: "company", header: "公司", width: "11%", cell: (j) => <span className="block truncate font-medium">{j.company}</span> },
    { id: "positions", header: "岗位", width: "22%", cell: (j) => <Positions positions={j.positions} /> },
    { id: "cities", header: "地点", width: "9%", cell: (j) => <span className="block truncate text-neutral-800">{j.cities.join(" · ")}</span> },
    { id: "category", header: "分类", width: "8%", cell: (j) => <span className="whitespace-nowrap text-neutral-800">{j.categoryLabel}</span> },
    { id: "degree", header: "学历要求", width: "9%", cell: (j) => <span className="whitespace-nowrap text-neutral-800">{j.degree ?? "—"}</span> },
    { id: "deadline", header: "投递截止", width: "12%", cell: (j) => <DeadlineCell job={j} /> },
    { id: "posted", header: "发布", width: "7%", cell: (j) => <span className="tabular-nums text-neutral-700">{j.postedAt.slice(5)}</span> },
    { id: "status", header: "投递状态", width: "8%", cell: (j) => <Tag variant={statusVariant(j.applicationStatus, isExpired(j))}>{statusLabel(j.applicationStatus, isExpired(j))}</Tag> },
    { id: "link", header: "公告", width: "5%", cell: (j) => <ExternalLink href={j.announcementLink}>查看 ↗</ExternalLink> },
    {
      id: "action",
      header: "操作",
      width: "6%",
      align: "right",
      cell: (j) => (
        <span className="inline-flex items-center gap-2">
          <ExternalLink href={j.deliveryAddress}>去投递</ExternalLink>
          <ActionButton job={j} onMarkApplied={onMarkApplied} />
        </span>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={jobs}
      rowKey={(j) => String(j.id)}
      caption="招聘公告列表"
      emptyMessage="没有匹配的公告，换个筛选条件试试。"
      minWidthClassName="min-w-[1040px]"
      renderCard={(j) => {
        const expired = isExpired(j);
        return (
          <div className="flex items-start gap-3">
            <StarButton starred={j.starred} onClick={() => onToggleStar(j.id)} className="mt-1" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-heading text-[17px]">{j.company}</span>
                <Tag>{j.categoryLabel}</Tag>
              </div>
              <Positions positions={j.positions} className="mt-1 block text-sm text-neutral-800" />
              <p className="mt-1 text-xs text-neutral-700">
                {j.cities.join(" · ")}
                {j.degree && (
                  <>
                    <span className="mx-1.5">·</span>
                    {j.degree}
                  </>
                )}
              </p>
              <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-2">
                <DeadlineCell job={j} />
                <Tag variant={statusVariant(j.applicationStatus, expired)}>{statusLabel(j.applicationStatus, expired)}</Tag>
                <span className="flex-1" />
                <ExternalLink href={j.announcementLink}>公告 ↗</ExternalLink>
                <ExternalLink href={j.deliveryAddress}>去投递</ExternalLink>
                <ActionButton job={j} onMarkApplied={onMarkApplied} />
              </div>
            </div>
          </div>
        );
      }}
    />
  );
}
```

- [ ] **Step 2: 类型与 lint**

```bash
npx tsc --noEmit && npx eslint . && npm test
```

期望：三者都通过。若 tsc 报 `src/views/practice` / `src/entities/quiz` 相关错误，说明 quiz 侧还是 mock，属预期（Task 10–12 处理）；只要 job 侧无错即可继续。

- [ ] **Step 3: 浏览器验收**

打开 `http://localhost:3000`（用户的 dev server 已在跑；若没有，`npm run dev`）：

1. 表格显示 Task 6 插入的泡泡玛特那条，岗位列显示 `商业分析、商品分析`
2. 点星标 → 立刻变实心；刷新页面仍是实心（已落库）
3. 点"标记已投" → 状态标签变"已投递"，按钮禁用
4. 切换分类为"央国企" → URL 变 `/?category=2`，列表为空态文案
5. 地址栏手输 `/?page=abc` → 页面正常（回落默认）
6. 窄屏（375px）→ 卡片形态，公告 / 去投递两个链接可点

- [ ] **Step 4: Commit**

```bash
git add src/widgets/job-table
git commit -m "feat(job-table): 适配公告级 DTO —— 多岗位折叠、多城市、真实链接、过期禁投"
```

---

### Task 9: Excel 导入脚本（行映射 TDD + exceljs IO）

**Files:**
- Create: `src/server/lib/job-row.ts`, `src/server/lib/job-row.test.ts`, `scripts/import-jobs.ts`

**Interfaces:**
- Consumes: `splitGradDegree/parseDeadline`；`isCategoryId`；`prisma`
- Produces:
  - `type RawRow = Record<string, string>`
  - `mapJobRow(raw: RawRow, sheetName: string, todayKey: string): MapResult`
  - `type MapResult = { ok: true; data: JobUpsertInput; key: { id?: number; serialNumber?: string } } | { ok: false; reason: string }`
  - `type JobUpsertInput`（与 Prisma `JobCreateInput` 去掉关系字段后同形）
  - `categoryFromSheetName(name: string): 1 | 2 | 3 | null`

- [ ] **Step 1: 写 `src/server/lib/job-row.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { categoryFromSheetName, mapJobRow } from "./job-row";

const today = "2026-09-12";

const sample = {
  createTime: "2026/9/8",
  recruitmentBatch: "秋招",
  enterpriseName: "泡泡玛特",
  enterpriseNature: "民营企业",
  industry: "玩具/潮玩/文创设计",
  workLocation: "北京、上海、杭州、东莞、海外",
  position: "商业分析、商品分析、主播运营",
  graduationYear: "2027届\n\n本科及以上",
  announcementLink: "https://mp.weixin.qq.com/s/x",
  deliveryAddress: "https://popmart.zhiye.com/campus/jobs",
  deadline: "2026.11.30",
};

describe("categoryFromSheetName", () => {
  it("按关键字推断", () => {
    expect(categoryFromSheetName("央国企")).toBe(2);
    expect(categoryFromSheetName("外企名单")).toBe(3);
    expect(categoryFromSheetName("秋招与实习")).toBe(1);
    expect(categoryFromSheetName("实习")).toBe(1);
    expect(categoryFromSheetName("Sheet1")).toBeNull();
  });
});

describe("mapJobRow", () => {
  it("行内有 categoryId 优先", () => {
    const r = mapJobRow({ ...sample, categoryId: "2" }, "秋招", today);
    expect(r.ok && r.data.categoryId).toBe(2);
  });

  it("行内没有则按表名", () => {
    const r = mapJobRow(sample, "外企", today);
    expect(r.ok && r.data.categoryId).toBe(3);
  });

  it("都没有则跳过", () => {
    const r = mapJobRow(sample, "Sheet1", today);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.reason).toMatch(/分类/);
  });

  it("拆届别学历、解析截止、保留原文", () => {
    const r = mapJobRow(sample, "秋招", today);
    if (!r.ok) throw new Error(r.reason);
    expect(r.data.graduationYear).toBe("2027届");
    expect(r.data.degree).toBe("本科及以上");
    expect(r.data.deadline).toBe("2026.11.30");
    expect(r.data.deadlineAt?.toISOString()).toBe("2026-11-30T00:00:00.000Z");
    expect(r.data.createTime?.toISOString()).toBe("2026-09-07T16:00:00.000Z");
  });

  it("截止解析不了：deadlineAt 为 null", () => {
    const r = mapJobRow({ ...sample, deadline: "尽快投递，招满即止" }, "秋招", today);
    expect(r.ok && r.data.deadlineAt).toBeNull();
  });

  it("缺公司名或岗位则跳过", () => {
    expect(mapJobRow({ ...sample, enterpriseName: "" }, "秋招", today).ok).toBe(false);
    expect(mapJobRow({ ...sample, position: "" }, "秋招", today).ok).toBe(false);
  });

  it("upsert 键：id 优先，其次 serialNumber", () => {
    expect(mapJobRow({ ...sample, id: "12", serialNumber: "S1" }, "秋招", today)).toMatchObject({ key: { id: 12 } });
    expect(mapJobRow({ ...sample, serialNumber: "S1" }, "秋招", today)).toMatchObject({ key: { serialNumber: "S1" } });
    expect(mapJobRow(sample, "秋招", today)).toMatchObject({ key: {} });
  });
});
```

- [ ] **Step 2: 运行，确认失败**

```bash
npx vitest run src/server/lib/job-row.test.ts
```

期望：FAIL，`Cannot find module './job-row'`。

- [ ] **Step 3: 写 `src/server/lib/job-row.ts`**

```ts
import { isCategoryId, type CategoryId } from "@entities/job";
import { keyToDate, keyToInstant } from "./dates";
import { parseDeadline, splitGradDegree } from "./parse";

export type RawRow = Record<string, string>;

export interface JobUpsertInput {
  serialNumber: string | null;
  categoryId: CategoryId;
  recruitmentBatch: string | null;
  enterpriseNature: string | null;
  industry: string | null;
  workLocation: string | null;
  position: string;
  enterpriseName: string;
  graduationYear: string | null;
  degree: string | null;
  announcementLink: string | null;
  deliveryAddress: string | null;
  deadline: string | null;
  deadlineAt: Date | null;
  createTime?: Date;
}

export type MapResult =
  | { ok: true; data: JobUpsertInput; key: { id?: number; serialNumber?: string } }
  | { ok: false; reason: string };

export function categoryFromSheetName(name: string): CategoryId | null {
  if (name.includes("央国企")) return 2;
  if (name.includes("外企")) return 3;
  if (name.includes("秋招") || name.includes("实习")) return 1;
  return null;
}

function opt(v: string | undefined): string | null {
  const s = v?.trim();
  return s ? s : null;
}

function resolveCategory(raw: RawRow, sheetName: string): CategoryId | null {
  const n = Number(raw.categoryId);
  if (raw.categoryId && Number.isInteger(n) && isCategoryId(n)) return n;
  return categoryFromSheetName(sheetName);
}

export function mapJobRow(raw: RawRow, sheetName: string, todayKey: string): MapResult {
  const enterpriseName = opt(raw.enterpriseName);
  const position = opt(raw.position);
  if (!enterpriseName) return { ok: false, reason: "缺少 enterpriseName" };
  if (!position) return { ok: false, reason: "缺少 position" };

  const categoryId = resolveCategory(raw, sheetName);
  if (!categoryId) return { ok: false, reason: `无法确定分类：行内无 categoryId，表名「${sheetName}」也不含关键字` };

  const { graduationYear, degree } = splitGradDegree(raw.graduationYear);
  const finalDegree = opt(raw.degree) ?? degree;

  const deadline = opt(raw.deadline);
  const deadlineKey = parseDeadline(deadline, todayKey);
  const createKey = parseDeadline(opt(raw.createTime), todayKey);

  const key: { id?: number; serialNumber?: string } = {};
  const idNum = Number(raw.id);
  if (raw.id && Number.isInteger(idNum) && idNum > 0) key.id = idNum;
  else if (opt(raw.serialNumber)) key.serialNumber = raw.serialNumber.trim();

  return {
    ok: true,
    key,
    data: {
      serialNumber: opt(raw.serialNumber),
      categoryId,
      recruitmentBatch: opt(raw.recruitmentBatch),
      enterpriseNature: opt(raw.enterpriseNature),
      industry: opt(raw.industry),
      workLocation: opt(raw.workLocation),
      position,
      enterpriseName,
      graduationYear,
      degree: finalDegree,
      announcementLink: opt(raw.announcementLink),
      deliveryAddress: opt(raw.deliveryAddress),
      deadline,
      deadlineAt: deadlineKey ? keyToDate(deadlineKey) : null,
      ...(createKey && { createTime: keyToInstant(createKey) }),
    },
  };
}
```

- [ ] **Step 4: 运行，确认通过**

```bash
npx vitest run src/server/lib/job-row.test.ts
```

期望：全部 PASS。

- [ ] **Step 5: 写 `scripts/import-jobs.ts`**

```ts
import "dotenv/config";
import ExcelJS from "exceljs";
import { prisma } from "../src/server/db";
import { dateKey } from "../src/server/lib/dates";
import { mapJobRow, type RawRow } from "../src/server/lib/job-row";

function cellText(cell: ExcelJS.Cell): string {
  const v = cell.value;
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return `${v.getFullYear()}/${v.getMonth() + 1}/${v.getDate()}`;
  if (typeof v === "object" && "hyperlink" in v && typeof v.hyperlink === "string") return v.hyperlink;
  return cell.text ?? String(v);
}

async function importSheet(ws: ExcelJS.Worksheet, today: string) {
  const headerRow = ws.getRow(1);
  const headers: (string | null)[] = [];
  headerRow.eachCell({ includeEmpty: true }, (cell, col) => {
    headers[col] = cellText(cell).trim() || null;
  });

  let created = 0;
  let updated = 0;
  const skipped: string[] = [];

  const rows: { n: number; raw: RawRow }[] = [];
  ws.eachRow((row, n) => {
    if (n === 1) return;
    const raw: RawRow = {};
    headers.forEach((h, col) => {
      if (h) raw[h] = cellText(row.getCell(col));
    });
    if (Object.values(raw).every((v) => !v.trim())) return;
    rows.push({ n, raw });
  });

  for (const { n, raw } of rows) {
    const r = mapJobRow(raw, ws.name, today);
    if (!r.ok) {
      skipped.push(`第 ${n} 行：${r.reason}`);
      continue;
    }
    const { data, key } = r;

    if (key.id !== undefined) {
      const exists = await prisma.job.findUnique({ where: { id: key.id }, select: { id: true } });
      await prisma.job.upsert({ where: { id: key.id }, update: data, create: { id: key.id, ...data } });
      exists ? updated++ : created++;
    } else if (key.serialNumber !== undefined) {
      const exists = await prisma.job.findFirst({ where: { serialNumber: key.serialNumber }, select: { id: true } });
      if (exists) {
        await prisma.job.update({ where: { id: exists.id }, data });
        updated++;
      } else {
        await prisma.job.create({ data });
        created++;
      }
    } else {
      await prisma.job.create({ data });
      created++;
    }
  }

  console.log(`${ws.name}：新增 ${created} · 更新 ${updated} · 跳过 ${skipped.length}`);
  for (const s of skipped) console.log(`  - ${s}`);
}

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error("用法：npm run db:import -- <文件.xlsx>");
    process.exit(1);
  }
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  const today = dateKey();
  for (const ws of wb.worksheets) await importSheet(ws, today);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 6: 用真实文件验证**

```bash
npm run db:import -- ./data/jobs.xlsx     # 用户提供的文件路径
npm run db:import -- ./data/jobs.xlsx     # 再跑一次
```

期望：第一次 `新增 N · 更新 0`；第二次 `新增 0 · 更新 N`（若 Excel 里既无 id 也无 serialNumber，第二次会再新增 N 条——这是 spec 约定的行为，提醒用户补一列 serialNumber）。

若 `id` 列存在且被 upsert 使用，之后运行 `npx prisma db execute --stdin <<< "SELECT setval(pg_get_serial_sequence('\"Job\"','id'), (SELECT MAX(id) FROM \"Job\"));"` 让自增序列跟上。

浏览器打开 `/`，确认真实公告显示正常、"等 N 个"折叠可展开。

- [ ] **Step 7: Commit**

```bash
git add src/server/lib/job-row.ts src/server/lib/job-row.test.ts scripts/import-jobs.ts
git commit -m "feat(import): Excel 导入脚本 —— 多工作表、按表名推断分类、幂等 upsert"
```

---

### Task 10: 刷题实体类型、种子题库、服务层

**Files:**
- Modify: `src/entities/quiz/model/types.ts`（整体替换）, `src/entities/quiz/index.ts`（整体替换）, `prisma/seed.ts`（追加题库）
- Create: `src/server/services/quiz.ts`
- Delete: `src/entities/quiz/model/data.ts`

**Interfaces:**
- Produces:
  - 类型：`QuizOption`, `TodayQuestion`, `TodayQuestionResult`, `SubmitResult`, `Dashboard`, `WrongItem`, `CompanySetItem`
  - `getTodayQuestion(userId): Promise<TodayQuestionResult>`
  - `submitAnswer(userId, questionId, picked): Promise<SubmitResult>`
  - `listWrongBook(userId): Promise<WrongItem[]>`
  - `getDashboard(userId): Promise<Dashboard>`
  - `setMastered(userId, questionId, mastered): Promise<void>`
  - `listCompanySets(): Promise<CompanySetItem[]>`
  - 常量 `DAILY_TARGET = 20`

- [ ] **Step 1: 整体替换 `src/entities/quiz/model/types.ts`**

```ts
export interface QuizOption {
  letter: "A" | "B" | "C" | "D";
  text: string;
}

export interface TodayQuestion {
  id: string;
  prompt: string;
  options: QuizOption[];
  category: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  source: string;
}

export interface TodayQuestionResult {
  question: TodayQuestion | null;
  indexLabel: string;
  attemptedToday: number;
}

export interface SubmitResult {
  correct: boolean;
  answer: string;
  explanation: string[];
  accuracyRate: number | null;
}

export interface WrongItem {
  questionId: string;
  title: string;
  due: string;
}

export interface Dashboard {
  streakDays: number;
  week: { label: string; done: boolean }[];
  weekSolved: number;
  weekTarget: number;
  totalSolved: number;
  categories: { id: string; label: string; count: number }[];
  wrongList: WrongItem[];
}

export interface CompanySetItem {
  id: string;
  company: string;
  track: string;
  focus: string;
  count: number;
}

export const DIFFICULTY_LABEL: Record<TodayQuestion["difficulty"], string> = {
  EASY: "难度 简单",
  MEDIUM: "难度 中等",
  HARD: "难度 困难",
};
```

- [ ] **Step 2: 整体替换 `src/entities/quiz/index.ts`**

```ts
export type {
  CompanySetItem,
  Dashboard,
  QuizOption,
  SubmitResult,
  TodayQuestion,
  TodayQuestionResult,
  WrongItem,
} from "./model/types";
export { DIFFICULTY_LABEL } from "./model/types";
```

- [ ] **Step 3: 删除 mock**

```bash
rm src/entities/quiz/model/data.ts
```

- [ ] **Step 4: 在 `prisma/seed.ts` 里追加题库种子**

把 `main()` 改为：

```ts
async function main() {
  await seedUser();
  await seedQuiz();
}
```

在 `seedUser` 之后追加：

```ts
const CATEGORIES = ["言语理解与表达", "计算机基础单选", "算法概念选择题", "行为面情景选择", "公司真题合集"];

const COMPANY_SETS = [
  { company: "阿里巴巴", track: "互联网 · 后端", focus: "JVM、MySQL 索引、分布式事务、场景设计题" },
  { company: "腾讯", track: "互联网 · 客户端", focus: "C++ 内存模型、网络协议、操作系统调度" },
  { company: "字节跳动", track: "互联网 · 全栈", focus: "算法中等偏难、浏览器渲染、系统设计" },
  { company: "华为", track: "硬件 · 嵌入式", focus: "C 语言指针、RTOS、数字电路与通信基础" },
];

type SeedQ = {
  category: string;
  companySet?: string;
  prompt: string;
  options: [string, string, string, string];
  answer: "A" | "B" | "C" | "D";
  explanation: string[];
  difficulty: "EASY" | "MEDIUM" | "HARD";
  source: string;
};

const QUESTIONS: SeedQ[] = [
  {
    category: "言语理解与表达",
    prompt: "一百多年来，现代语言科学经历了三个重要时期，历史比较语言学、结构主义语言学和转换生成语言学分别是这三个时期的代表。对这段话最准确的复述是：",
    options: [
      "现代语言学发展了一百多年",
      "现代语言学经历了历史比较语言学、结构主义语言学和转换生成语言学三大时期",
      "历史比较语言学、结构主义语言学和转换生成语言学是现代语言学",
      "历史比较语言学、结构主义语言学和转换生成语言学都经历了一百多年的发展",
    ],
    answer: "B",
    explanation: [
      "材料的主干是「现代语言科学经历了三个重要时期」，后半句只是为三个时期各举一个代表。B 完整保留了「经历三个时期」这一主干与三者的对应关系，是最准确的复述。",
      "A 只取了时间信息，丢掉主干；C 把「代表」偷换为「就是现代语言学」，扩大范围；D 把「一百多年」错分给三个时期各自，属于偷换对象。",
    ],
    difficulty: "MEDIUM",
    source: "行测真题",
  },
  {
    category: "计算机基础单选",
    companySet: "腾讯",
    prompt: "TCP 三次握手中，下列说法错误的是：",
    options: ["第一次握手客户端发送 SYN", "第二次握手服务端回复 SYN+ACK", "第三次握手客户端发送 ACK", "三次握手完成后服务端才分配端口"],
    answer: "D",
    explanation: ["端口在监听时即已绑定，与握手完成无关。"],
    difficulty: "EASY",
    source: "计算机网络",
  },
  {
    category: "算法概念选择题",
    companySet: "字节跳动",
    prompt: "关于快速排序平均时间复杂度的说法，正确的是：",
    options: ["O(n)", "O(n log n)", "O(n²)", "O(log n)"],
    answer: "B",
    explanation: ["平均情况下每层划分 O(n)，递归深度 O(log n)。最坏 O(n²) 出现在每次都选到极值作枢轴。"],
    difficulty: "EASY",
    source: "算法基础",
  },
  {
    category: "行为面情景选择",
    prompt: "小组分工时两位成员对同一模块都想负责且互不相让，作为组长最恰当的做法是：",
    options: ["直接指定其中一人", "让两人各自陈述方案后按项目需要决定并说明理由", "把模块一分为二各做一半", "先搁置，等其他模块做完再说"],
    answer: "B",
    explanation: ["既尊重双方又以项目目标为准绳，并给出可复盘的理由，是冲突处理的基本原则。"],
    difficulty: "MEDIUM",
    source: "行为面试",
  },
  {
    category: "计算机基础单选",
    companySet: "阿里巴巴",
    prompt: "MySQL InnoDB 中，下列哪种情况最可能导致索引失效？",
    options: ["对索引列使用 = 比较", "在索引列上使用函数", "使用覆盖索引", "按索引列排序"],
    answer: "B",
    explanation: ["对列施加函数后优化器无法利用 B+ 树的有序性，只能全表扫描。"],
    difficulty: "MEDIUM",
    source: "数据库",
  },
  {
    category: "计算机基础单选",
    companySet: "华为",
    prompt: "C 语言中 `int *p[3]` 声明的是：",
    options: ["指向含 3 个 int 的数组的指针", "含 3 个 int 指针的数组", "指向 int 的三级指针", "语法错误"],
    answer: "B",
    explanation: ["`[]` 优先级高于 `*`，先结合为数组，再看元素类型为 `int *`。"],
    difficulty: "MEDIUM",
    source: "C 语言",
  },
  {
    category: "算法概念选择题",
    companySet: "阿里巴巴",
    prompt: "下列数据结构中，适合实现 LRU 缓存的是：",
    options: ["数组", "哈希表 + 双向链表", "单链表", "栈"],
    answer: "B",
    explanation: ["哈希表 O(1) 定位，双向链表 O(1) 移动到头部与删除尾部。"],
    difficulty: "MEDIUM",
    source: "数据结构",
  },
  {
    category: "计算机基础单选",
    companySet: "字节跳动",
    prompt: "浏览器渲染流程中，`display: none` 与 `visibility: hidden` 的主要区别是：",
    options: ["都不占布局空间", "前者不生成布局盒，后者生成但不绘制", "前者能被键盘聚焦", "两者完全等价"],
    answer: "B",
    explanation: ["`display: none` 元素不参与布局树；`visibility: hidden` 保留占位仅跳过绘制。"],
    difficulty: "EASY",
    source: "前端基础",
  },
  {
    category: "言语理解与表达",
    prompt: "「他这个人，做事总是雷声大雨点小。」这句话的意思是：",
    options: ["做事很有气势", "说得多做得少", "喜欢在雨天工作", "做事雷厉风行"],
    answer: "B",
    explanation: ["成语「雷声大雨点小」比喻声势大而实际行动少。"],
    difficulty: "EASY",
    source: "行测真题",
  },
  {
    category: "算法概念选择题",
    companySet: "腾讯",
    prompt: "操作系统调度中，最可能导致「饥饿」的算法是：",
    options: ["先来先服务", "时间片轮转", "非抢占式优先级调度", "多级反馈队列"],
    answer: "C",
    explanation: ["低优先级进程在高优先级进程持续到达时可能永远得不到 CPU。"],
    difficulty: "MEDIUM",
    source: "操作系统",
  },
];

async function seedQuiz() {
  const categoryIds = new Map<string, string>();
  for (const name of CATEGORIES) {
    const c = await prisma.questionCategory.upsert({ where: { name }, update: {}, create: { name } });
    categoryIds.set(name, c.id);
  }

  const setIds = new Map<string, string>();
  for (const s of COMPANY_SETS) {
    const existing = await prisma.companySet.findFirst({ where: { company: s.company } });
    const row = existing
      ? await prisma.companySet.update({ where: { id: existing.id }, data: s })
      : await prisma.companySet.create({ data: s });
    setIds.set(s.company, row.id);
  }

  let created = 0;
  for (const q of QUESTIONS) {
    const exists = await prisma.question.findFirst({ where: { prompt: q.prompt }, select: { id: true } });
    if (exists) continue;
    await prisma.question.create({
      data: {
        categoryId: categoryIds.get(q.category)!,
        companySetId: q.companySet ? setIds.get(q.companySet) : null,
        prompt: q.prompt,
        options: (["A", "B", "C", "D"] as const).map((letter, i) => ({ letter, text: q.options[i] })),
        answer: q.answer,
        explanation: q.explanation,
        difficulty: q.difficulty,
        source: q.source,
      },
    });
    created++;
  }
  console.log(`题库：分类 ${CATEGORIES.length} · 题集 ${COMPANY_SETS.length} · 新增题目 ${created}`);
}
```

- [ ] **Step 5: 跑种子**

```bash
npm run db:seed
```

期望：`题库：分类 5 · 题集 4 · 新增题目 10`；再跑一次 `新增题目 0`。

- [ ] **Step 6: 写 `src/server/services/quiz.ts`**

```ts
import "server-only";
import { prisma } from "@/server/db";
import { NotFoundError } from "@/server/lib/http";
import { addDays, computeStreak, dateKey, dueLabel, keyToInstant, weekStartKey } from "@/server/lib/dates";
import type {
  CompanySetItem,
  Dashboard,
  QuizOption,
  SubmitResult,
  TodayQuestionResult,
  WrongItem,
} from "@entities/quiz";

export const DAILY_TARGET = 20;
const WEEK_LABELS = ["一", "二", "三", "四", "五", "六", "日"];

async function attemptedTodayCount(userId: string, today: string): Promise<number> {
  return prisma.attempt.count({ where: { userId, answeredAt: { gte: keyToInstant(today) } } });
}

export async function getTodayQuestion(userId: string): Promise<TodayQuestionResult> {
  const today = dateKey();
  const attempted = await prisma.attempt.findMany({ where: { userId }, select: { questionId: true }, distinct: ["questionId"] });
  const attemptedIds = attempted.map((a) => a.questionId);

  const q = await prisma.question.findFirst({
    where: attemptedIds.length ? { id: { notIn: attemptedIds } } : {},
    orderBy: { id: "asc" },
    include: { category: { select: { name: true } } },
  });

  const attemptedToday = await attemptedTodayCount(userId, today);
  return {
    question: q
      ? {
          id: q.id,
          prompt: q.prompt,
          options: q.options as unknown as QuizOption[],
          category: q.category.name,
          difficulty: q.difficulty,
          source: q.source,
        }
      : null,
    indexLabel: `试题 ${Math.min(attemptedToday + 1, DAILY_TARGET)} / ${DAILY_TARGET}`,
    attemptedToday,
  };
}

export async function submitAnswer(userId: string, questionId: string, picked: string): Promise<SubmitResult> {
  const q = await prisma.question.findUnique({ where: { id: questionId } });
  if (!q) throw new NotFoundError(`题目 ${questionId} 不存在`);

  const correct = picked === q.answer;
  const today = dateKey();

  await prisma.$transaction(async (tx) => {
    await tx.attempt.create({ data: { userId, questionId, picked, correct } });
    if (!correct) {
      await tx.wrongBookEntry.upsert({
        where: { userId_questionId: { userId, questionId } },
        update: { mastered: false, nextReviewAt: keyToInstant(addDays(today, 1)) },
        create: { userId, questionId, nextReviewAt: keyToInstant(addDays(today, 1)) },
      });
    }
  });

  const [total, right] = await Promise.all([
    prisma.attempt.count({ where: { questionId } }),
    prisma.attempt.count({ where: { questionId, correct: true } }),
  ]);

  return {
    correct,
    answer: q.answer,
    explanation: q.explanation,
    accuracyRate: total === 0 ? null : Math.round((100 * right) / total),
  };
}

export async function listWrongBook(userId: string): Promise<WrongItem[]> {
  const today = dateKey();
  const rows = await prisma.wrongBookEntry.findMany({
    where: { userId, mastered: false },
    orderBy: { nextReviewAt: "asc" },
    include: { question: { select: { prompt: true } } },
  });
  return rows.map((r) => ({
    questionId: r.questionId,
    title: r.question.prompt.length > 24 ? `${r.question.prompt.slice(0, 24)}…` : r.question.prompt,
    due: dueLabel(r.nextReviewAt, today),
  }));
}

export async function getDashboard(userId: string): Promise<Dashboard> {
  const today = dateKey();
  const weekStart = weekStartKey(today);
  const yearAgo = keyToInstant(addDays(today, -365));

  const [attempts, categories, wrongList] = await Promise.all([
    prisma.attempt.findMany({ where: { userId, answeredAt: { gte: yearAgo } }, select: { questionId: true, answeredAt: true } }),
    prisma.questionCategory.findMany({ include: { _count: { select: { questions: true } } }, orderBy: { name: "asc" } }),
    listWrongBook(userId),
  ]);

  const dayKeys = new Set(attempts.map((a) => dateKey(a.answeredAt)));
  const weekKeys = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekSet = new Set(weekKeys);

  const weekSolved = new Set(attempts.filter((a) => weekSet.has(dateKey(a.answeredAt))).map((a) => a.questionId)).size;
  const totalSolved = new Set(attempts.map((a) => a.questionId)).size;

  return {
    streakDays: computeStreak(dayKeys, today),
    week: weekKeys.map((k, i) => ({ label: WEEK_LABELS[i], done: dayKeys.has(k) })),
    weekSolved,
    weekTarget: DAILY_TARGET,
    totalSolved,
    categories: categories.map((c) => ({ id: c.id, label: c.name, count: c._count.questions })),
    wrongList,
  };
}

export async function setMastered(userId: string, questionId: string, mastered: boolean): Promise<void> {
  const r = await prisma.wrongBookEntry.updateMany({ where: { userId, questionId }, data: { mastered } });
  if (r.count === 0) throw new NotFoundError("错题本里没有这道题");
}

export async function listCompanySets(): Promise<CompanySetItem[]> {
  const rows = await prisma.companySet.findMany({ include: { _count: { select: { questions: true } } } });
  return rows.map((s) => ({ id: s.id, company: s.company, track: s.track, focus: s.focus, count: s._count.questions }));
}
```

- [ ] **Step 7: 类型检查 server 目录**

```bash
npx tsc --noEmit 2>&1 | grep -E "src/server" || echo "server 目录无类型错误"
```

- [ ] **Step 8: Commit**

```bash
git add src/entities/quiz prisma/seed.ts src/server/services/quiz.ts
git rm -q src/entities/quiz/model/data.ts 2>/dev/null || true
git commit -m "feat(quiz): 实体类型、题库种子与服务层"
```

---

### Task 11: 刷题 REST 路由

**Files:**
- Create: `src/app/api/quiz/today/route.ts`, `src/app/api/quiz/attempts/route.ts`, `src/app/api/quiz/dashboard/route.ts`, `src/app/api/quiz/wrong-book/route.ts`, `src/app/api/quiz/wrong-book/[questionId]/route.ts`, `src/app/api/quiz/company-sets/route.ts`

- [ ] **Step 1: 写 `src/app/api/quiz/today/route.ts`**

```ts
import { handle, json } from "@/server/lib/http";
import { getCurrentUserId } from "@/server/auth";
import { getTodayQuestion } from "@/server/services/quiz";

export async function GET() {
  return handle(async () => json(await getTodayQuestion(await getCurrentUserId())));
}
```

- [ ] **Step 2: 写 `src/app/api/quiz/attempts/route.ts`**

```ts
import { z } from "zod";
import { handle, json, readJson } from "@/server/lib/http";
import { getCurrentUserId } from "@/server/auth";
import { submitAnswer } from "@/server/services/quiz";

const bodySchema = z.object({
  questionId: z.string().min(1),
  picked: z.enum(["A", "B", "C", "D"]),
});

export async function POST(req: Request) {
  return handle(async () => {
    const { questionId, picked } = await readJson(req, bodySchema);
    const userId = await getCurrentUserId();
    return json(await submitAnswer(userId, questionId, picked));
  });
}
```

- [ ] **Step 3: 写 `src/app/api/quiz/dashboard/route.ts`**

```ts
import { handle, json } from "@/server/lib/http";
import { getCurrentUserId } from "@/server/auth";
import { getDashboard } from "@/server/services/quiz";

export async function GET() {
  return handle(async () => json(await getDashboard(await getCurrentUserId())));
}
```

- [ ] **Step 4: 写 `src/app/api/quiz/wrong-book/route.ts`**

```ts
import { handle, json } from "@/server/lib/http";
import { getCurrentUserId } from "@/server/auth";
import { listWrongBook } from "@/server/services/quiz";

export async function GET() {
  return handle(async () => json({ items: await listWrongBook(await getCurrentUserId()) }));
}
```

- [ ] **Step 5: 写 `src/app/api/quiz/wrong-book/[questionId]/route.ts`**

```ts
import { z } from "zod";
import { handle, noContent, readJson } from "@/server/lib/http";
import { getCurrentUserId } from "@/server/auth";
import { setMastered } from "@/server/services/quiz";

const bodySchema = z.object({ mastered: z.boolean() });

export async function PUT(req: Request, ctx: RouteContext<"/api/quiz/wrong-book/[questionId]">) {
  return handle(async () => {
    const { questionId } = await ctx.params;
    const { mastered } = await readJson(req, bodySchema);
    await setMastered(await getCurrentUserId(), questionId, mastered);
    return noContent();
  });
}
```

- [ ] **Step 6: 写 `src/app/api/quiz/company-sets/route.ts`**

```ts
import { handle, json } from "@/server/lib/http";
import { listCompanySets } from "@/server/services/quiz";

export async function GET() {
  return handle(async () => json({ items: await listCompanySets() }));
}
```

- [ ] **Step 7: 验证**

```bash
curl -s localhost:3000/api/quiz/today | jq '.question.prompt[0:20], .indexLabel'
QID=$(curl -s localhost:3000/api/quiz/today | jq -r '.question.id')
curl -s -X POST localhost:3000/api/quiz/attempts -H 'content-type: application/json' -d "{\"questionId\":\"$QID\",\"picked\":\"A\"}" | jq '.correct, .answer'
curl -s localhost:3000/api/quiz/dashboard | jq '.streakDays, .totalSolved, (.wrongList | length)'
curl -s -X PUT "localhost:3000/api/quiz/wrong-book/$QID" -H 'content-type: application/json' -d '{"mastered":true}' -o /dev/null -w '%{http_code}\n'
curl -s localhost:3000/api/quiz/company-sets | jq '.items | length'
curl -s -X POST localhost:3000/api/quiz/attempts -H 'content-type: application/json' -d '{"questionId":"x","picked":"E"}' -o /dev/null -w '%{http_code}\n'
```

期望依次：题干前 20 字 + `"试题 1 / 20"`；`false "B"`（第一题答案是 B）；`1 1 1`；`204`；`4`；`400`。

- [ ] **Step 8: Commit**

```bash
git add src/app/api/quiz
git commit -m "feat(api): 刷题 REST 路由"
```

---

### Task 12: 刷题页接入真实数据

**Files:**
- Modify: `src/app/practice/page.tsx`（整体替换）, `src/views/practice/PracticePage.tsx`（整体替换）, `src/features/quiz-question/QuizQuestion.tsx`（整体替换）, `src/widgets/practice-sidebar/PracticeSidebar.tsx`（整体替换）, `src/widgets/company-sets/CompanySets.tsx`（整体替换）

**Interfaces:**
- Consumes: `getTodayQuestion/getDashboard/listCompanySets`；quiz DTO 类型；`DIFFICULTY_LABEL`
- Produces: `PracticePage({ today, dashboard, companySets })`，`QuizQuestion({ today })`，`PracticeSidebar({ dashboard })`，`CompanySets({ sets })`

- [ ] **Step 1: 整体替换 `src/app/practice/page.tsx`**

```tsx
import { connection } from "next/server";
import { getCurrentUserId } from "@/server/auth";
import { getDashboard, getTodayQuestion, listCompanySets } from "@/server/services/quiz";
import { PracticePage } from "@pages/practice/PracticePage";

export default async function Practice() {
  await connection();
  const userId = await getCurrentUserId();
  const [today, dashboard, companySets] = await Promise.all([
    getTodayQuestion(userId),
    getDashboard(userId),
    listCompanySets(),
  ]);
  return <PracticePage today={today} dashboard={dashboard} companySets={companySets} />;
}
```

- [ ] **Step 2: 整体替换 `src/views/practice/PracticePage.tsx`**

```tsx
import { Navbar } from "@widgets/navbar/Navbar";
import { PracticeSidebar } from "@widgets/practice-sidebar/PracticeSidebar";
import { CompanySets } from "@widgets/company-sets/CompanySets";
import { QuizQuestion } from "@features/quiz-question/QuizQuestion";
import type { CompanySetItem, Dashboard, TodayQuestionResult } from "@entities/quiz";

interface PracticePageProps {
  today: TodayQuestionResult;
  dashboard: Dashboard;
  companySets: CompanySetItem[];
}

export function PracticePage({ today, dashboard, companySets }: PracticePageProps) {
  return (
    <div className="flex min-h-full flex-col bg-bg">
      <Navbar active="practice" trailing={`连续打卡 ${dashboard.streakDays} 天`} />

      <div className="grid grid-cols-1 border-b border-divider lg:grid-cols-[minmax(0,1fr)_300px]">
        <QuizQuestion today={today} />
        <PracticeSidebar dashboard={dashboard} />
      </div>

      <CompanySets sets={companySets} />
    </div>
  );
}
```

- [ ] **Step 3: 整体替换 `src/features/quiz-question/QuizQuestion.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@shared/ui/Button";
import { Tag } from "@shared/ui/Tag";
import { Kicker } from "@shared/ui/Kicker";
import { cn } from "@shared/lib/cn";
import { DIFFICULTY_LABEL, type QuizOption, type SubmitResult, type TodayQuestionResult } from "@entities/quiz";

interface QuizQuestionProps {
  today: TodayQuestionResult;
}

type OptionState = "idle" | "picked" | "right" | "wrong";

function optionState(option: QuizOption, picked: string | null, result: SubmitResult | null): OptionState {
  const isPicked = picked === option.letter;
  if (result && option.letter === result.answer) return "right";
  if (result && isPicked) return "wrong";
  if (isPicked) return "picked";
  return "idle";
}

const rowClass: Record<OptionState, string> = {
  idle: "border-divider hover:border-accent-400",
  picked: "border-accent-600 bg-accent-100",
  right: "border-accent bg-accent-100",
  wrong: "border-neutral-400 bg-neutral-100 text-neutral-600",
};

const badgeClass: Record<OptionState, string> = {
  idle: "border-divider text-neutral-700",
  picked: "border-accent bg-accent text-bg",
  right: "border-accent bg-accent text-bg",
  wrong: "border-neutral-400 text-neutral-600",
};

const markText: Record<OptionState, string> = { idle: "", picked: "已选", right: "正确答案", wrong: "你的选择" };

export function QuizQuestion({ today }: QuizQuestionProps) {
  const router = useRouter();
  const [picked, setPicked] = useState<string | null>(null);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [showExplanation, setShowExplanation] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [mastered, setMastered] = useState(false);

  const q = today.question;
  const todayKey = new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", month: "2-digit", day: "2-digit" })
    .format(new Date())
    .replace("/", " / ");

  if (!q) {
    return (
      <div className="px-4 py-16 text-center sm:px-8">
        <Kicker className="text-accent-700">今日一题 · {todayKey}</Kicker>
        <p className="mt-3 text-lg">题库已刷完，明天再来。</p>
      </div>
    );
  }

  async function submit() {
    if (!picked || !q || submitting) return;
    setSubmitting(true);
    const res = await fetch("/api/quiz/attempts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ questionId: q.id, picked }),
    });
    setSubmitting(false);
    if (!res.ok) {
      console.error("提交失败", await res.text());
      return;
    }
    setResult(await res.json());
    setShowExplanation(true);
  }

  async function markMastered() {
    if (!q) return;
    setMastered(true);
    const res = await fetch(`/api/quiz/wrong-book/${q.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mastered: true }),
    });
    if (!res.ok) setMastered(false);
  }

  return (
    <div className="px-4 py-8 sm:px-8 sm:py-9">
      <div className="flex flex-wrap items-center gap-2.5">
        <Kicker className="text-accent-700">今日一题 · {todayKey}</Kicker>
        <Tag>{q.category}</Tag>
        <Tag>{DIFFICULTY_LABEL[q.difficulty]}</Tag>
        <Tag variant="outline">{q.source}</Tag>
        <span className="text-xs tabular-nums text-neutral-700">{today.indexLabel}</span>
      </div>

      <h2 className="mt-3 max-w-[820px] text-[22px] leading-snug sm:text-[26px] lg:text-[30px]">{q.prompt}</h2>

      <div className="mt-5 flex max-w-[880px] flex-col gap-2.5">
        {q.options.map((option) => {
          const state = optionState(option, picked, result);
          return (
            <button
              key={option.letter}
              type="button"
              disabled={result !== null}
              aria-pressed={picked === option.letter}
              onClick={() => setPicked(option.letter)}
              className={cn(
                "grid cursor-pointer grid-cols-[26px_minmax(0,1fr)] items-center gap-x-3.5 gap-y-2 border px-4 py-3 text-left transition-colors sm:grid-cols-[26px_minmax(0,1fr)_auto]",
                "disabled:cursor-default",
                rowClass[state],
              )}
            >
              <span className={cn("flex size-[26px] items-center justify-center border font-heading text-sm tabular-nums", badgeClass[state])}>
                {option.letter}
              </span>
              <span className="text-[15px] leading-relaxed">{option.text}</span>
              {markText[state] && (
                <span className={cn("col-start-2 whitespace-nowrap text-xs sm:col-start-3", state === "wrong" ? "text-neutral-600" : "text-accent-700")}>
                  {markText[state]}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2.5">
        {result === null ? (
          <Button variant="primary" size="lg" blueprint className="px-5" disabled={!picked || submitting} onClick={submit}>
            {submitting ? "提交中…" : "提交并查看答案"}
          </Button>
        ) : (
          <Button variant="primary" size="lg" blueprint className="px-5" onClick={() => setShowExplanation((s) => !s)}>
            {showExplanation ? "收起解析" : "展开解析"}
          </Button>
        )}
        {result && !result.correct && (
          <Button size="lg" disabled={mastered} onClick={markMastered}>
            {mastered ? "已标记掌握" : "标记已掌握"}
          </Button>
        )}
        <Button variant="ghost" size="lg" disabled={result === null} onClick={() => router.refresh()}>
          下一题 →
        </Button>
        <div className="hidden flex-1 sm:block" />
        <span className="text-xs tabular-nums text-neutral-700">{picked ? `已选 ${picked}` : "未作答"}</span>
      </div>

      {result && showExplanation && (
        <div className="mt-6 max-w-[880px] border-t border-divider pt-5">
          <div className="flex flex-wrap items-center gap-3">
            <Kicker className="text-accent-700">答案 {result.answer}</Kicker>
            <Tag variant={result.correct ? "accent" : "neutral"}>{result.correct ? "回答正确" : "回答错误 · 已加入错题本"}</Tag>
            {result.accuracyRate !== null && (
              <span className="text-xs tabular-nums text-neutral-700">本题正确率 {result.accuracyRate}%</span>
            )}
          </div>
          {result.explanation.map((p, i) => (
            <p key={i} className={cn("text-sm leading-[1.8] text-neutral-800", i === 0 ? "mt-3" : "mt-2.5")}>
              {p}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: 整体替换 `src/widgets/practice-sidebar/PracticeSidebar.tsx`**

```tsx
import { Button } from "@shared/ui/Button";
import { Tag } from "@shared/ui/Tag";
import { Kicker } from "@shared/ui/Kicker";
import { cn } from "@shared/lib/cn";
import type { Dashboard } from "@entities/quiz";

interface PracticeSidebarProps {
  dashboard: Dashboard;
}

export function PracticeSidebar({ dashboard }: PracticeSidebarProps) {
  return (
    <aside className="flex flex-col gap-7 border-t border-divider px-4 py-8 sm:px-8 lg:border-l lg:border-t-0 lg:px-6 lg:py-9">
      <section>
        <Kicker className="mb-3">打卡仪表盘</Kicker>
        <div className="flex items-baseline gap-2">
          <span className="font-heading text-[44px] leading-none tabular-nums">{dashboard.streakDays}</span>
          <span className="text-[13px] text-neutral-700">天连续</span>
        </div>
        <div className="mt-4 flex gap-1.5">
          {dashboard.week.map((d) => (
            <div key={d.label} className="flex flex-1 flex-col items-center gap-1.5">
              <div className={cn("h-[34px] w-full border border-divider", d.done && "bg-accent")} />
              <span className="text-[10px] tabular-nums text-neutral-700">{d.label}</span>
            </div>
          ))}
        </div>
        <div className="mt-3.5 flex justify-between text-xs text-neutral-700">
          <span>
            本周 <b className="tabular-nums">{dashboard.weekSolved}</b> / {dashboard.weekTarget} 题
          </span>
          <span>
            累计 <b className="tabular-nums">{dashboard.totalSolved}</b> 题
          </span>
        </div>
      </section>

      <section>
        <Kicker className="mb-2.5">题库分类</Kicker>
        <ul>
          {dashboard.categories.map((c) => (
            <li key={c.id} className="flex items-center justify-between border-b border-hairline py-2.5 text-sm">
              <span>{c.label}</span>
              <span className="text-xs tabular-nums text-neutral-700">{c.count}</span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <Kicker className="mb-2.5">错题本 · 复习队列</Kicker>
        {dashboard.wrongList.length === 0 ? (
          <p className="text-[13px] text-neutral-700">还没有错题。</p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {dashboard.wrongList.map((w) => (
              <li key={w.questionId} className="flex items-center justify-between gap-2.5 text-[13px]">
                <span className="truncate">{w.title}</span>
                <Tag className="text-[10px]">{w.due}</Tag>
              </li>
            ))}
          </ul>
        )}
        <Button className="mt-3 w-full" disabled={dashboard.wrongList.length === 0}>
          开始复习 {dashboard.wrongList.length} 题
        </Button>
      </section>
    </aside>
  );
}
```

- [ ] **Step 5: 整体替换 `src/widgets/company-sets/CompanySets.tsx`**

```tsx
import { BlueprintCard } from "@shared/ui/BlueprintCard";
import type { CompanySetItem } from "@entities/quiz";

interface CompanySetsProps {
  sets: CompanySetItem[];
}

export function CompanySets({ sets }: CompanySetsProps) {
  return (
    <section className="px-4 pb-9 pt-7 sm:px-8">
      <div className="flex flex-wrap items-baseline gap-x-3.5 gap-y-1">
        <h4 className="text-xl">按公司真题分组</h4>
        <span className="text-[13px] text-neutral-700">整理自往年面经与在招岗位的考点分布</span>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {sets.map((s) => (
          <BlueprintCard key={s.id} className="p-[18px]">
            <p className="text-[10px] uppercase tracking-[0.1em] text-accent">{s.track}</p>
            <p className="mt-2 font-heading text-xl leading-tight">{s.company}</p>
            <p className="mt-2 text-[13px] leading-relaxed text-neutral-700">{s.focus}</p>
            <div className="mt-4 flex items-center justify-between border-t border-divider pt-3 text-xs">
              <span className="tabular-nums text-neutral-700">{s.count} 题</span>
              <span className="text-neutral-500">即将开放</span>
            </div>
          </BlueprintCard>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 6: 全量校验**

```bash
npx tsc --noEmit && npx eslint . && npm test
```

期望：三者全部通过，无任何输出错误。

- [ ] **Step 7: 浏览器验收 `/practice`**

1. 首屏显示种子里的第一题（言语理解），侧栏"题库分类"五个分类各有数量，公司题集四张卡各有题数
2. 选 B → 提交 → "回答正确"，正确率显示，"下一题"可点；点"下一题"→ 出现第二题（TCP）
3. 第二题故意选 A → "回答错误 · 已加入错题本"，出现"标记已掌握"按钮；侧栏错题本立即（刷新后）出现该题、标签"明天"
4. 点"标记已掌握" → 刷新后错题本里消失
5. 打卡格今天亮起，连续天数 ≥ 1
6. 窄屏 375px 下正常堆叠

- [ ] **Step 8: Commit**

```bash
git add src/app/practice src/views/practice src/features/quiz-question src/widgets/practice-sidebar src/widgets/company-sets
git commit -m "feat(practice): 刷题页接入真实题库、作答、错题本与打卡"
```

---

### Task 13: 收尾 —— README、最终校验

**Files:**
- Modify: `README.md`（追加"本地数据库"一节）

- [ ] **Step 1: 在 `README.md` 末尾追加**

````markdown
## 本地数据库

```bash
cp .env.example .env         # 首次
npm run db:up                # 起 Postgres（需要 Docker）
npm run db:migrate           # 建表
npm run db:seed              # 开发账号 + 题库
npm run db:import -- ./data/jobs.xlsx   # 导入岗位（可重复执行）
npm run dev
```

- 岗位 Excel：每张工作表首行为表头，列名与 `prisma/schema.prisma` 里 `Job` 的字段同名；`categoryId` 列可省略，此时按工作表名推断（含"央国企"→2、"外企"→3、含"秋招"或"实习"→1）
- 当前所有"属于用户"的数据都挂在种子账号 `dev@local` 上；接入登录时只需改 `src/server/auth.ts` 的 `getCurrentUserId()`
- REST 接口一览见 `docs/superpowers/specs/2026-09-12-backend-data-layer-design.md` 第 7 节
````

- [ ] **Step 2: 确认 mock 文件已不存在、无残留引用**

```bash
ls src/entities/job/model/data.ts src/entities/quiz/model/data.ts src/entities/job/lib 2>&1 | grep -c "No such file" # 期望 3
grep -rn "model/data" src --include="*.ts*" || echo "无残留引用"
```

- [ ] **Step 3: 最终全量校验**

```bash
npx tsc --noEmit && npx eslint . && npm test && echo ALL GREEN
```

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: 本地数据库与导入说明"
```
