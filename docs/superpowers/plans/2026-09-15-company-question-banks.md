# 公司题库（公司 → 分类 → 题目）实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 题库改为 公司 → 分类 → 题目 三层，支持单选 / 多选 / 判断，学生按分类顺序刷题，配额按全站作答计数；后台可管理公司 / 分类并上传 Excel 导入题目。

**Architecture:** 后端 Prisma 加 `Company`、`QuestionType`，删 `CompanySet`；判题 / 形状校验抽成纯函数 `src/lib/grade.ts`，xlsx 解析抽成 `src/lib/import-questions.ts`；学生端 `/api/quiz` 改为 `banks` + `categories/{id}/next` + `attempts(picked[])`；后台加公司 / 分类端点与分类导入。学生端新增 `/practice/$categoryId` 路由；管理端题库页改为左树右表。

**Tech Stack:** Hono 4 + @hono/zod-openapi + Prisma 7 + ExcelJS + vitest；React 19 + TanStack Router / Query + Tailwind v4 + openapi-fetch。

**Spec:** `docs/superpowers/specs/2026-09-15-company-question-banks-design.md`（本仓库 `job_hunt_front`）

## Global Constraints

- 三个仓库：后端 `/Users/black/Desktop/job_hunt_back`（分支 `feat/company-banks`，基线 main 0a1c0b5）；学生端 `/Users/black/Desktop/job_hunt_front`（分支 `feat/company-banks`，基线 main e3aa332）；管理端 `/Users/black/Desktop/job_hunt_admin`（分支 `feat/company-banks`，基线 main d4a4efc）。
- 命令前 `source ~/.nvm/nvm.sh && nvm use`；只用 pnpm。
- 后端每个任务结束前：`pnpm openapi && git add openapi.json && pnpm typecheck && pnpm lint && pnpm test`；测试用 `.env` 的 `TEST_DATABASE_URL`（库名 `_test` 结尾）；新迁移用 `pnpm prisma migrate dev --name <名>` 只会作用于 `DATABASE_URL`（开发库）——测试库由 vitest setup 自动 `migrate deploy`（若不是，先 `TEST_DATABASE_URL` 下 `prisma migrate deploy`，看 `src/test/setup.ts` / README 的既有做法）。不要停 / 启 PostgreSQL。
- 前端 / 管理端每个任务结束前：`pnpm typecheck && pnpm lint && pnpm test && pnpm build`；`src/api/schema.d.ts` 只能由 `OPENAPI_SOURCE=/Users/black/Desktop/job_hunt_back/openapi.json pnpm gen:api` 生成。
- 不提交：`.env`、`src/generated`、`dist`、`node_modules`、`package-lock.json`。
- `z` 从 `@hono/zod-openapi` 导入；请求体 `required: true`；可空引用 `z.union([S, z.null()])`；`.openapi("Name")` 全局唯一。业务错误 `AppError` / `NotFoundError`，路由不抛 500。
- 提交信息中文 Conventional 前缀，结尾一行 `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`。
- 不要启动 / 停止 3000、3001 端口的东西；验证用 3012（后端）、5173（学生端）、5174（管理端），只停自己起的进程。
- 配额常量不变：GUEST 20 / FREE 200 / PRO null；语义改为"累计作答的不同题数上限"。

---

### Task 1（后端）: 数据模型迁移、判题纯函数、学生端刷题 API 重写

**Files:**
- Modify: `prisma/schema.prisma`, `prisma/seed.ts`, `prisma/quiz-data.ts`
- Create: `prisma/migrations/20260915090000_company_banks/migration.sql`, `src/lib/grade.ts`, `src/lib/grade.test.ts`
- Modify: `src/contract/quiz.ts`, `src/contract/admin.ts`（题目相关 schema 先按 §3.3 改形状，端点在 Task 2）, `src/services/quiz.ts`, `src/routes/quiz.ts`, `src/routes/quiz.test.ts`, `src/routes/admin/questions.ts`（最小改动以编译通过）, `src/routes/admin.test.ts`（题库用例按新形状改）, `src/lib/access.ts`（注释 + `usedQuestionQuota`）, `src/test/db.ts`（TRUNCATE 列表：去 `CompanySet` 加 `Company`）, `README.md`, `openapi.json`

**Interfaces:**
- Produces: `grade.ts` 导出 `normalizeAnswer(letters: string[]): string`、`grade(type, answer: string, picked: string[]): boolean`、`validateQuestionShape(type, options, answer): string | null`（返回错误文案或 null）、`JUDGE_OPTIONS`；契约 `QuestionTypeSchema / QuizOptionLetterSchema / quizOptionsSchema / AnswerLettersSchema / QuizQuotaSchema / QuizBanksSchema / QuizNextSchema / QuizQuestionPublicSchema / SubmitAttemptSchema / QuizAnswerResultSchema / QuizDashboardSchema`；`AdminQuestionSchema / AdminQuestionBodySchema / AdminQuestionPatchSchema / adminQuestionQuerySchema` 新形状；`src/lib/access.ts` 导出 `usedQuestionQuota(userId): Promise<number>` 与 `assertQuestionQuota(userId, access, role)`。

- [ ] **Step 1: schema.prisma**

按 spec §2 修改：新增 `Company`、`QuestionType`；`QuestionCategory` 加 `companyId`（必填）、`sortOrder`、`@@unique([companyId, name])`（删 `name @unique`）；`Question` 加 `type`、`section`、`sortOrder`、`@@index([categoryId, sortOrder])`，`category` 关系加 `onDelete: Cascade`，删 `companySetId` / `companySet`；删 `CompanySet` 模型；`difficulty` 加 `@default(MEDIUM)`。

- [ ] **Step 2: 手写迁移 `prisma/migrations/20260915090000_company_banks/migration.sql`**

```sql
CREATE TYPE "QuestionType" AS ENUM ('SINGLE', 'MULTI', 'JUDGE');

CREATE TABLE "Company" (
  "id" TEXT NOT NULL, "name" TEXT NOT NULL, "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Company_name_key" ON "Company"("name");
INSERT INTO "Company" ("id", "name", "sortOrder") VALUES ('company-general', '通用题库', 0);

ALTER TABLE "QuestionCategory" ADD COLUMN "companyId" TEXT, ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;
UPDATE "QuestionCategory" SET "companyId" = 'company-general';
ALTER TABLE "QuestionCategory" ALTER COLUMN "companyId" SET NOT NULL;
DROP INDEX "QuestionCategory_name_key";
CREATE UNIQUE INDEX "QuestionCategory_companyId_name_key" ON "QuestionCategory"("companyId", "name");
ALTER TABLE "QuestionCategory" ADD CONSTRAINT "QuestionCategory_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Question"
  ADD COLUMN "type" "QuestionType" NOT NULL DEFAULT 'SINGLE',
  ADD COLUMN "section" TEXT,
  ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;
UPDATE "Question" q SET "sortOrder" = s.rn FROM (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "categoryId" ORDER BY "id") AS rn FROM "Question"
) s WHERE q."id" = s."id";
ALTER TABLE "Question" ALTER COLUMN "difficulty" SET DEFAULT 'MEDIUM';
ALTER TABLE "Question" DROP CONSTRAINT "Question_categoryId_fkey";
ALTER TABLE "Question" ADD CONSTRAINT "Question_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "QuestionCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Question" DROP CONSTRAINT "Question_companySetId_fkey";
ALTER TABLE "Question" DROP COLUMN "companySetId";
DROP TABLE "CompanySet";
CREATE INDEX "Question_categoryId_sortOrder_idx" ON "Question"("categoryId", "sortOrder");
```

跑 `pnpm prisma migrate dev`（会检测到已有迁移文件并应用，再用 `pnpm prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --shadow-database-url <TEST_DATABASE_URL>` 或直接 `prisma migrate dev` 的 drift 检查确认 schema 与迁移一致；若约束名与既有 init 迁移不同，以 `prisma/migrations/20260912142540_init/migration.sql` 里的实际名字为准）。`pnpm prisma generate`。

- [ ] **Step 3: seed**

`quiz-data.ts`：删 `COMPANY_SETS`，`SeedQuestion` 删 `companySetId`；`seed.ts`：先 `company.upsert({ where: { id: "company-general" }, update: {}, create: { id: "company-general", name: "通用题库" } })`，分类 upsert 带 `companyId`，题目 data 加 `type: "SINGLE"`，`sortOrder` = 在同分类内的序号（按 QUESTIONS 顺序计数）。`pnpm db:seed` 跑通两次。

- [ ] **Step 4: `src/lib/grade.ts` + 测试（先写测试）**

```ts
import type { QuestionType } from "../generated/prisma/enums";
export const LETTERS = ["A", "B", "C", "D", "E", "F"] as const;
export type Letter = (typeof LETTERS)[number];
export interface OptionShape { letter: string; text: string }
export const JUDGE_OPTIONS: OptionShape[] = [{ letter: "A", text: "正确" }, { letter: "B", text: "错误" }];

/** 去重、按字母排序、拼成 "ABC" */
export function normalizeAnswer(letters: readonly string[]): string {
  return [...new Set(letters)].sort().join("");
}
export function grade(type: QuestionType, answer: string, picked: readonly string[]): boolean {
  const p = normalizeAnswer(picked);
  if (type === "MULTI") return p === answer;
  return picked.length === 1 && p === answer;
}
/** 返回错误文案；null = 合法 */
export function validateQuestionShape(type: QuestionType, options: readonly OptionShape[], answer: string): string | null {
  const letters = options.map((o) => o.letter);
  if (letters.some((l, i) => l !== LETTERS[i])) return "选项字母必须从 A 起连续";
  if (options.some((o) => !o.text.trim())) return "选项内容不能为空";
  if (!/^[A-F]+$/.test(answer) || normalizeAnswer([...answer]) !== answer) return "答案必须是已排序且不重复的字母";
  if ([...answer].some((l) => !letters.includes(l))) return "答案包含不存在的选项";
  if (type === "JUDGE") {
    if (options.length !== 2 || options[0].text !== "正确" || options[1].text !== "错误") return "判断题选项必须是 A 正确 / B 错误";
    if (answer.length !== 1) return "判断题只能有一个答案";
    return null;
  }
  if (options.length < 2 || options.length > 6) return "选项数量需在 2–6 之间";
  if (type === "SINGLE" && answer.length !== 1) return "单选题只能有一个答案";
  if (type === "MULTI" && (options.length < 3 || answer.length < 2)) return "多选题至少 3 个选项、2 个正确答案";
  return null;
}
```

`grade.test.ts`（纯函数，不用数据库；vitest 的 `include` 是 `src/**/*.test.ts`）：`normalizeAnswer(["C","A","A"]) === "AC"`；`grade("MULTI","AC",["C","A"])` true、`["A"]` false；`grade("SINGLE","B",["B"])` true、`["A","B"]` false；`validateQuestionShape` 对 6 个非法用例返回文案、3 个合法用例返回 null。

- [ ] **Step 5: 契约 `src/contract/quiz.ts`**

按 spec §3.1 / §3.2 重写：

```ts
export const QuestionTypeSchema = z.enum(["SINGLE", "MULTI", "JUDGE"]).openapi("QuestionType");
export const QuizOptionLetterSchema = z.enum(["A", "B", "C", "D", "E", "F"]).openapi("QuizOptionLetter");
export const QuizOptionSchema = z.object({ letter: QuizOptionLetterSchema, text: z.string().min(1) }).openapi("QuizOption");
export const quizOptionsSchema = z.array(QuizOptionSchema).min(2).max(6);
export const AnswerLettersSchema = z.string().regex(/^[A-F]+$/, "答案必须是 A–F 的字母");
export const QuizQuotaSchema = z.object({ tier: TierSchema, limit: z.number().int().nullable(), used: z.number().int() }).openapi("QuizQuota");
export const SubmitAttemptSchema = z.object({ questionId: z.string().min(1), picked: z.array(QuizOptionLetterSchema).min(1).max(6) }).openapi("SubmitAttempt");
export const QuizQuestionPublicSchema = z.object({
  id: z.string(), type: QuestionTypeSchema, section: z.string().nullable(), prompt: z.string(),
  options: z.array(QuizOptionSchema), category: z.string(), company: z.string(), difficulty: z.string(), source: z.string(),
}).openapi("QuizQuestionPublic");
export const QuizBanksSchema = z.object({
  companies: z.array(z.object({ id: z.string(), name: z.string(), categories: z.array(z.object({
    id: z.string(), name: z.string(), total: z.number().int(), answered: z.number().int(), correct: z.number().int() })) })),
  quota: QuizQuotaSchema,
}).openapi("QuizBanks");
export const QuizNextSchema = z.object({
  category: z.object({ id: z.string(), name: z.string(), company: z.string(), total: z.number().int() }),
  question: z.union([QuizQuestionPublicSchema, z.null()]),
  index: z.number().int(), answered: z.number().int(),
  exhausted: z.enum(["QUOTA", "ALL"]).nullable(),
}).openapi("QuizNext");
export const QuizAnswerResultSchema = z.object({
  correct: z.boolean(), answer: z.array(QuizOptionLetterSchema), explanation: z.array(z.string()), accuracyRate: z.number().int().nullable(),
}).openapi("QuizAnswerResult");
export const QuizDashboardSchema = z.object({
  streakDays, week, weekSolved, weekTarget, totalSolved, wrongList, quota: QuizQuotaSchema,
}).openapi("QuizDashboard");   // 删 categories / access
export const CategoryIdParamSchema = z.object({ categoryId: z.string().min(1).openapi({ param: { name: "categoryId", in: "path" } }) });
```
删 `QuizTodaySchema`、`CompanySetItemSchema`、`CompanySetListSchema` 与"兼容旧名字"导出（把用到的地方改成新名字）。

`src/contract/admin.ts` 题目部分改为：

```ts
export const adminQuestionQuerySchema = z.object({
  q, companyId: z.string().min(1).optional(), categoryId: z.string().min(1).optional(),
  type: QuestionTypeSchema.optional(), section: z.string().trim().min(1).optional(), published: BoolQuery, ...pageQuery });
export const AdminQuestionSchema = z.object({
  id, companyId: z.string(), companyName: z.string(), categoryId: z.string(), categoryName: z.string(),
  type: QuestionTypeSchema, section: z.string().nullable(), sortOrder: z.number().int(), prompt: z.string(),
  options: z.array(QuizOptionSchema), answer: AnswerLettersSchema, explanation: z.array(z.string()),
  difficulty: DifficultySchema, source: z.string(), published: z.boolean() }).openapi("AdminQuestion");
export const AdminQuestionBodySchema = z.object({
  categoryId: z.string().min(1), type: QuestionTypeSchema, section: z.string().trim().nullable().optional(),
  sortOrder: z.number().int().optional(), prompt: z.string().min(1), options: quizOptionsSchema, answer: AnswerLettersSchema,
  explanation: z.array(z.string()), difficulty: DifficultySchema, source: z.string().min(1), published: z.boolean() }).openapi("AdminQuestionBody");
export const AdminQuestionPatchSchema = AdminQuestionBodySchema.partial().openapi("AdminQuestionPatch");
```
`AdminQuizMetaSchema`、公司 / 分类 schema 由 Task 2 写；本任务先把 `AdminQuizMetaSchema` 改成 `{ companies: [{ id, name, sortOrder, categories: [{ id, name, sortOrder, questionCount, publishedCount }] }] }` 以便 `quiz-meta` 路由编译（Task 2 再补端点）。

- [ ] **Step 6: `src/lib/access.ts`**

`Access.questions` 注释改为"累计可作答的不同题数上限"。新增：

```ts
export async function usedQuestionQuota(userId: string): Promise<number> {
  const rows = await prisma.attempt.findMany({ where: { userId }, select: { questionId: true }, distinct: ["questionId"] });
  return rows.length;
}
export function quotaOf(access: Access, role: "STUDENT" | "ADMIN", used: number) {
  return { tier: access.tier, limit: role === "ADMIN" ? null : access.questions, used };
}
export function quotaExhausted(q: { limit: number | null; used: number }) { return q.limit !== null && q.used >= q.limit; }
```
（`prisma` 从 `../db` 导入；若循环依赖，把这三个函数放到 `src/services/quota.ts`。）

- [ ] **Step 7: `src/services/quiz.ts` 重写**

- `listBanks(userId, access, role): Promise<QuizBanks>`：`company.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], include: { categories: { orderBy: [...], include: { _count: { select: { questions: { where: { published: true } } } } } } } })`；用户作答：`attempt.findMany({ where: { userId }, select: { questionId, correct, question: { select: { categoryId } } } })` 聚合成每分类 `answered`（不同题数）与 `correct`（有任一正确作答的不同题数）；`quota`。
- `nextQuestion(userId, categoryId, access, role): Promise<QuizNext>`：分类不存在 → `NotFoundError`；`total = question.count({ categoryId, published })`；`answered` = 该分类内该用户作答过的不同题数；配额：`used = usedQuestionQuota`，若 `quotaExhausted` → `{ question: null, exhausted: "QUOTA", index: answered, … }`；否则找 `question.findFirst({ where: { categoryId, published, attempts: { none: { userId } } }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }], include: { category: { include: { company: true } } } })`；无 → `exhausted: "ALL"`；`index = question.count({ categoryId, published, OR: [{ sortOrder: { lt } }, { sortOrder: eq, id: { lt } }] }) + 1`。
- `submitAnswer(userId, questionId, picked: string[], access, role)`：题不存在 / 未发布 → 404；若该用户未答过此题且 `quotaExhausted` → `AppError(403, "FORBIDDEN", "作答次数已用完，登录或升级后继续")`；`correct = grade(q.type, q.answer, picked)`；`attempt.create({ picked: normalizeAnswer(picked), correct })`；错题本逻辑不变；返回 `answer: [...q.answer]`。
- `getDashboard`：去掉 categories / access，加 `quota`。
- `listWrongBook`：去掉 visible 过滤（配额是计数，不再限制可见）。
- 删 `visibleQuestionIds`、`getTodayQuestion`、`listCompanySets`。

- [ ] **Step 8: `src/routes/quiz.ts`**

路由：`GET /banks`（`listQuizBanks`）、`GET /categories/{categoryId}/next`（`getNextQuestion`，404）、`POST /attempts`（`submitAttempt`，400/403/404）、`GET /dashboard`、`GET /wrong-book`、`PUT /wrong-book/{questionId}`。删 `/today`、`/company-sets`。

- [ ] **Step 9: `src/routes/admin/questions.ts` 最小适配**

去掉 companySet 相关校验与字段；列表 `include: { category: { include: { company: true } } }`，映射 `companyId / companyName / type / section / sortOrder`；POST / PATCH 用 `validateQuestionShape(type, options, answer)`（PATCH 时用合并后的值：先 `findUnique` 取现有 type/options/answer）→ 非 null 抛 `AppError(400, "VALIDATION", msg)`；`quiz-meta` 改为按公司分组（Task 2 会再加端点，这里先让它返回正确形状）。`question-categories` POST 暂时要求 body `{ companyId, name }`（把 `AdminCategoryBodySchema` 改成这个形状，公司不存在 → 400）。

- [ ] **Step 10: 测试**

`src/test/db.ts` 的 TRUNCATE 列表把 `"CompanySet"` 换成 `"Company"`（放在 `"QuestionCategory"` 之后）。新增辅助 `seedBank()`：建公司「测试公司」+ 分类「基础」，插入 25 道题（sortOrder 1–25：1–21 单选 4 选项答案 `"B"`，22–23 多选 4 选项答案 `"AC"`，24–25 判断 `JUDGE_OPTIONS` 答案 `"A"`），返回 `{ companyId, categoryId, ids }`。

`quiz.test.ts` 重写用例：
1. `GET /api/quiz/banks`（管理员会话）→ 公司 1 个，分类 `total: 25, answered: 0`；答 2 题后 `answered: 2`。
2. `next` 返回 sortOrder 1 的题、`index: 1`；答对后 `next` 返回第 2 题、`index: 2, answered: 1`。
3. 多选：POST `picked: ["C","A"]` 对 22 题 → `correct: true, answer: ["A","C"]`；`["A"]` → false 且进错题本。判断题 `["B"]` 对 24 题 → false。
4. 配额（游客 `guestClient()`）：依次答 20 道不同题 → 第 21 道 POST 403，`next` 返回 `question: null, exhausted: "QUOTA"`，`banks.quota = { tier: "GUEST", limit: 20, used: 20 }`；重答第 1 题（已答过）仍 200。
5. 管理员答完 25 题后 `next` → `exhausted: "ALL"`。
6. `dashboard.quota.limit === null`（管理员），`wrongList` 含错题。

`admin.test.ts`：题库用例改为先建公司 / 分类（`POST /api/admin/question-categories` body `{ companyId, name }`，公司用 `prisma.company.create`），题目 body 加 `type: "SINGLE"`；加一条 `type: "MULTI"` 但 `answer: "A"` → 400。

- [ ] **Step 11: README**（刷题 API 与配额语义一节）、`pnpm openapi && git add openapi.json && pnpm typecheck && pnpm lint && pnpm test`；提交 `feat(quiz): 公司 → 分类 → 题目模型，单选 / 多选 / 判断，按分类刷题与全站作答配额`。

---

### Task 2（后端）: 公司 / 分类端点、Excel 导入、CLI

**Files:**
- Create: `src/routes/admin/companies.ts`, `src/lib/import-questions.ts`, `src/lib/import-questions.test.ts`, `scripts/import-questions.ts`
- Modify: `src/contract/admin.ts`（公司 / 分类 / 导入 schema）, `src/routes/admin/questions.ts`（quiz-meta、question-categories PATCH/DELETE/import 挂这里或搬到 companies.ts）, `src/routes/admin/index.ts`, `src/routes/admin/summary.ts`（`companies` 计数）, `src/routes/admin.test.ts`, `package.json`（`db:import-questions`）, `README.md`, `openapi.json`

**Interfaces:**
- Consumes: Task 1 的 `validateQuestionShape / normalizeAnswer / JUDGE_OPTIONS`、契约。
- Produces: `importQuestionWorkbook(categoryId: string, buffer: ArrayBuffer | Buffer): Promise<{ created: number; skipped: string[] }>`（抛 `WorkbookParseError` 同 `import-jobs.ts`）。

- [ ] **Step 1: 契约**

```ts
export const AdminCompanySchema = z.object({ id: z.string(), name: z.string(), sortOrder: z.number().int() }).openapi("AdminCompany");
export const AdminCompanyBodySchema = z.object({ name: z.string().trim().min(1).max(50) }).openapi("AdminCompanyBody");
export const AdminCompanyPatchSchema = z.object({ name: z.string().trim().min(1).max(50).optional(), sortOrder: z.number().int().optional() }).openapi("AdminCompanyPatch");
export const AdminCategorySchema = z.object({ id: z.string(), companyId: z.string(), name: z.string(), sortOrder: z.number().int() }).openapi("AdminCategory");
export const AdminCategoryBodySchema = z.object({ companyId: z.string().min(1), name: z.string().trim().min(1).max(50) }).openapi("AdminCategoryBody");
export const AdminCategoryPatchSchema = z.object({ name: z.string().trim().min(1).max(50).optional(), sortOrder: z.number().int().optional() }).openapi("AdminCategoryPatch");
export const AdminQuestionImportResultSchema = z.object({ created: z.number().int(), skipped: z.array(z.string()) }).openapi("AdminQuestionImportResult");
```

- [ ] **Step 2: `src/lib/import-questions.ts` + 测试（先写测试）**

```ts
const TYPE_MAP: Record<string, QuestionType> = { 单选题: "SINGLE", 单选: "SINGLE", 多选题: "MULTI", 多选: "MULTI", 判断题: "JUDGE", 判断: "JUDGE" };
interface ParsedRow { row: number; sortOrder: number; type: QuestionType; section: string | null; prompt: string; options: OptionShape[]; answer: string }
export function parseQuestionSheet(ws: ExcelJS.Worksheet): { rows: ParsedRow[]; skipped: string[] }
export async function importQuestionWorkbook(categoryId: string, buffer: ArrayBuffer | Buffer): Promise<{ created: number; skipped: string[] }>
```
`parseQuestionSheet`：表头行 = 第一行；列名 trim 后映射（`题号 题型 所属部分 题干 A B C D E F 答案`）；缺 `题干` 或 `答案` 列 → 抛 `WorkbookParseError("找不到 题干 / 答案 列")`。每行：题干空 → 跳过（空行不记 skipped；有答案无题干记「第 n 行：缺少题干」）；`answer = normalizeAnswer([...String(答案).toUpperCase().replace(/[^A-F]/g, "")])`；`type` = `TYPE_MAP[题型]`，缺省推断（见 spec）；JUDGE → `options = JUDGE_OPTIONS`（忽略 A/B 列）；其他 → 取 A–F 非空列，按顺序赋字母；`validateQuestionShape` 非 null → skipped「第 n 行：<文案>」；`sortOrder = Number(题号)` 有效正整数否则 = 行号 - 1。
`importQuestionWorkbook`：找第一个表头含 `题干` 与 `答案` 的工作表（用 `cellText` 同 `import-jobs.ts`，可把 `cellText` 抽到 `src/lib/excel.ts` 共用）；查分类（不存在 → `NotFoundError`）与公司名；已存在题干集合 `question.findMany({ where: { categoryId }, select: { prompt } })`；重复 → skipped「第 n 行：题干已存在」；`$transaction(createMany)`；`source = `${company.name} · ${category.name}``。

测试 `import-questions.test.ts`（打测试库，`describe.skipIf(!hasDb)`）：ExcelJS 内存表 6 行：单选 / 多选 `AC` / 判断（A、B 列留空）/ 缺题干 / 多选但答案 1 个字母 / 与第 1 行同题干 → `created: 3`，`skipped` 长度 3 且含「题干已存在」；再导一次 → `created: 0, skipped: 3 + 3`；库里判断题 options 为 `JUDGE_OPTIONS`，多选 answer `"AC"`，sortOrder 等于题号列。

- [ ] **Step 3: 路由**

`src/routes/admin/companies.ts`：`listAdminQuizMeta`（`GET /quiz-meta`，从 questions.ts 搬过来）、`createAdminCompany`（201，重名 400「公司已存在」）、`updateAdminCompany`（204，重名 400，404）、`deleteAdminCompany`（204，404）、`createAdminQuestionCategory`（`POST /question-categories`，公司不存在 400、同公司重名 400「分类已存在」）、`updateAdminQuestionCategory`（`PATCH /question-categories/{id}`）、`deleteAdminQuestionCategory`、`importAdminQuestions`（`POST /question-categories/{id}/import`，multipart + `bodyLimit` 20 MB，同 `jobs.ts` 写法；`WorkbookParseError` → 400「无法解析 Excel 文件」）。在 `index.ts` 挂载；从 `questions.ts` 删除搬走的路由。`summary.ts` 加 `companies: prisma.company.count()`（契约 `AdminSummarySchema` 加字段）。

- [ ] **Step 4: CLI `scripts/import-questions.ts`**

`pnpm db:import-questions <公司名> <分类名> <文件.xlsx>`：公司 / 分类 `upsert`（分类按 `companyId_name`），`readFileSync` → `importQuestionWorkbook` → 打印 `新增 x · 跳过 y` 与明细。`package.json` 加脚本。

- [ ] **Step 5: 测试（追加 admin.test.ts）**

公司：创建 → 重名 400 → PATCH 改名 → 建分类 → 同名分类 400 → 上传 xlsx（3 行有效）`created: 3` → `quiz-meta` 里该分类 `questionCount: 3` → 删除公司 → 题目数 0、分类数 0。

- [ ] **Step 6:** README（后台端点清单补 8 条；「题库导入」一节：xlsx 列说明、CLI 用法）；`pnpm openapi && git add openapi.json && pnpm typecheck && pnpm lint && pnpm test`；提交 `feat(admin): 公司 / 分类管理与题库 Excel 导入`。

---

### Task 3（学生端）: 题库选择页与按分类刷题

**Files:**
- Modify: `src/api/schema.d.ts`（生成）, `src/api/types.ts`, `src/api/queries.ts`, `src/api/mutations.ts`, `src/entities/quiz/index.ts`, `src/routes/practice.tsx`, `src/features/quiz-question/QuizQuestion.tsx`, `src/widgets/practice-sidebar/PracticeSidebar.tsx`, `src/widgets/access-banner/{access-message.ts,access-message.test.ts,AccessBanner.tsx}`, `src/views/practice/PracticePage.tsx`, 使用 `AccessBanner` 的 `views/job-board/JobBoardPage.tsx`
- Create: `src/routes/practice.$categoryId.tsx`, `src/views/practice/BankPickerPage.tsx`, `src/features/quiz-question/pick.ts`, `src/features/quiz-question/pick.test.ts`
- Delete: `src/widgets/company-sets/`

**Interfaces:**
- Consumes: 后端 `openapi.json`（Task 2 完成后的 main / 分支）。

- [ ] **Step 1: 类型与数据层**

`OPENAPI_SOURCE=/Users/black/Desktop/job_hunt_back/openapi.json pnpm gen:api`。`types.ts` / `entities/quiz`：加 `QuizBanks, QuizNext, QuizQuota, QuestionType`，删 `QuizToday, CompanySetItem`。`queries.ts`：`quizBanksQuery()`（key `["quiz","banks"]`）、`quizNextQuery(categoryId)`（key `["quiz","next",categoryId]`，`staleTime: Infinity, refetchOnWindowFocus: false`）、`quizDashboardQuery()` 不变；删 `quizTodayQuery / companySetsQuery`。`useSubmitAttempt`：`vars: { questionId: string; picked: QuizOptionLetter[] }`，成功后失效 `["quiz","dashboard"]` 与 `["quiz","banks"]`。

- [ ] **Step 2: `pick.ts` + 测试（先写测试）**

```ts
export function togglePick(type: QuestionType, picked: QuizOptionLetter[], letter: QuizOptionLetter): QuizOptionLetter[]
// SINGLE / JUDGE：返回 [letter]（再点同一个仍是 [letter]）；MULTI：有则去掉，无则加入，按字母排序
```
3 条用例。

- [ ] **Step 3: 路由与页面**

`routes/practice.tsx`：loader `Promise.all([ensureQueryData(quizBanksQuery()), ensureQueryData(quizDashboardQuery()), ensureQueryData(meQuery())])`，component `BankPickerPage`。
`routes/practice.$categoryId.tsx`：loader `Promise.all([fetchQuery({ ...quizNextQuery(params.categoryId), staleTime: 0 }), ensureQueryData(quizDashboardQuery()), ensureQueryData(meQuery())])`，component `PracticePage`，`errorComponent: ErrorPanel`。

`BankPickerPage`：`Navbar active="practice"`；主区 `grid lg:grid-cols-[minmax(0,1fr)_300px]`：左侧按公司分组，每个公司一个 `section`（`Kicker` 公司名），分类行：名称、`已答 {answered} / {total} · 答对 {correct}`、进度条（`div` 宽度百分比）、右侧 `Link to="/practice/$categoryId"` 按钮文案：`answered === 0` → 开始，`answered < total` → 继续，否则 已完成（`total === 0` 时禁用「暂无题目」）；顶部配额用尽时 `AccessBanner`（`quota`）。右侧 `PracticeSidebar`（去掉"题库分类"段，其余不变）。
`PracticePage`（`$categoryId`）：`Navbar`；面包屑 `Link to="/practice"`「题库」› `{category.company} · {category.name}`；`第 {index} / {category.total} 题`；`QuizQuestion`（props 改：`question`, `indexLabel`, `result`, `submitting`, `loadingNext`, `onSubmit(picked: QuizOptionLetter[])`, `onNext`；内部 `picked: QuizOptionLetter[]` 用 `togglePick`；标签：`Tag` 题型（单选题 / 多选题 / 判断题）、`section`、`category`、`difficulty`；MULTI 显示"多选"提示且提交按钮在 `picked.length >= 1` 可用；揭晓：`result.answer.includes(letter)` → right，`picked` 含但非答案 → wrong）；「下一题」→ `fetchQuery({ ...quizNextQuery(id), staleTime: 0 })` + `submit.reset()`；`exhausted === "ALL"` → 「本题库已全部答完」+ `Link` 返回题库；`"QUOTA"` → `AccessBanner`。

- [ ] **Step 4: AccessBanner**

`accessMessage(input: { kind: "jobs"; access: Access } | { kind: "questions"; quota: QuizQuota })`：jobs 分支不变；questions：`quota.limit === null || quota.used < quota.limit` → null；GUEST → `{ title: "未登录只能作答 20 道题", body: "已用完 20 道，登录后可作答 200 道。", action 登录 }`；FREE → `{ title: "免费账号可作答 200 道题", body: "已用完，升级 PRO 不限次数。", action 了解 PRO }`。`AccessBanner` props 同步（`{ access, kind: "jobs" } | { quota, kind: "questions" }`）；`JobBoardPage` 调用改为新形状；测试改为 4 条（jobs GUEST、questions GUEST 用尽、questions FREE 未用尽 → null、PRO → null）。

- [ ] **Step 5:** 删 `widgets/company-sets`；`pnpm typecheck && pnpm lint && pnpm test && pnpm build`；浏览器验证（后端 3012 + 学生端 5173，游客刷含多选 / 判断的分类）；提交 `feat(practice): 按公司 / 分类刷题，多选与判断题，作答配额提示`。

---

### Task 4（管理端）: 题库页重构（公司 / 分类树、题型、Excel 导入）

**Files:**
- Modify: `src/api/schema.d.ts`（生成）, `src/api/types.ts`, `src/api/queries.ts`, `src/api/mutations.ts`, `src/routes/_admin/questions.tsx`, `src/views/questions/{QuestionsPage,QuestionDialog,CategoryDialog,question-form,question-form.test}.tsx|ts`, `src/views/dashboard/DashboardPage.tsx`（公司卡）
- Create: `src/views/questions/BankTree.tsx`, `src/views/questions/CompanyDialog.tsx`, `src/views/questions/ImportQuestionsDialog.tsx`

- [ ] **Step 1: 类型与数据层**

gen:api；`types.ts` 加 `AdminCompany / AdminCompanyBody / AdminCategory / AdminCategoryBody / AdminQuestionImportResult / QuestionType / QuizOptionLetter`；`quizMetaQuery` 不变（形状随 schema）；mutations：`useCreateCompany(body)`、`usePatchCompany({ id, body })`、`useDeleteCompany(id)`、`useCreateCategory(body: { companyId, name })`、`usePatchCategory({ id, body })`、`useDeleteCategory(id)`、`useImportQuestions({ categoryId, file })`（FormData bodySerializer 同 `useImportJobs`）；全部成功后失效 `["admin","quiz-meta"]`、`["admin","questions"]`、`["admin","summary"]`。

- [ ] **Step 2: `question-form.ts` + 测试（先写测试）**

`QuestionFormState`：`{ categoryId, type: QuestionType, section, sortOrder: string, prompt, options: string[] (2–6), answer: QuizOptionLetter[], explanation, difficulty, source, published }`；`emptyQuestionForm`（type SINGLE，4 个空选项）；`setType(state, type)`：切到 JUDGE → options `["正确","错误"]`、answer `[]`；从 JUDGE 切走 → 4 个空选项；`toQuestionBody`：题干 / 分类 / 来源必填；选项 trim 非空（JUDGE 固定）；SINGLE / JUDGE 答案恰 1 个「请选择正确答案」；MULTI ≥ 2「多选题至少选两个正确答案」且选项 ≥ 3；`body.options = options.map((text, i) => ({ letter: LETTERS[i], text }))`，`body.answer = [...answer].sort().join("")`，`sortOrder` 数字或省略；`fromQuestion`。测试 5 条。

- [ ] **Step 3: 页面**

路由 `validateSearch` 加 `companyId?, categoryId?, type?, section?`。`QuestionsPage`：`grid lg:grid-cols-[260px_minmax(0,1fr)]`：左 `BankTree`（公司 → 分类，选中高亮；公司行操作 重命名 / 删除（confirm「删除公司会连同其下分类与题目一起删除」）；分类行操作 重命名 / 删除 / 导入；底部「新建公司」；公司下「新建分类」），点击分类 → `navigate({ search: { categoryId, page: 1 } })`，点击公司 → `companyId`；右侧工具栏：搜索、题型 select、所属部分 Input（防抖）、状态 select、「新增题目」（未选分类时禁用，创建时默认选中当前分类）；表格列：序号、题型 Tag、所属部分、题干（截断）、状态、操作。`QuestionDialog`：按 §5 的字段；选项行可增删（2–6）、答案 radio / checkbox；JUDGE 时选项只读。`CompanyDialog` / `CategoryDialog`（新建 / 重命名共用，props `{ mode, initial }`）。`ImportQuestionsDialog`：说明列格式 + 文件选择 → 上传 → 结果（created / skipped 明细）。

- [ ] **Step 4:** 概览加「公司」`StatCard`；`pnpm typecheck && pnpm lint && pnpm test && pnpm build`；浏览器验证（后端 3012、管理端 5174：新建公司 / 分类、导入一个小 xlsx、新建多选题）；提交 `feat(questions): 公司 / 分类树、三种题型与 Excel 导入`。

---

## 自检记录

- 覆盖：spec §2 → T1；§3.1–3.2 → T1；§3.3 → T1（题目形状）+ T2；§4 → T3；§5 → T4；§6 测试分布各任务；§7 导入由控制者用 CLI 执行并浏览器验收。
- 类型一致：`picked: QuizOptionLetter[]`（T1 契约 ↔ T3 mutation）；`QuizNext.exhausted` 值与 T3 分支一致；`AdminCategoryBody { companyId, name }` 在 T1 先改、T2 / T4 使用；`validateQuestionShape` 文案由 T1 定义、T2 导入 skipped 直接引用；`LETTERS` 在后端 `grade.ts` 与管理端 `question-form.ts` 各自定义（双份，spec 注明）。
- 无占位：错误文案、路由、key、字段均已写明。
