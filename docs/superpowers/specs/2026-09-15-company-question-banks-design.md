# 公司题库（公司 → 分类 → 题目）设计

日期：2026-09-15
状态：已与用户确认两项关键决策（配额全站共通；刷题改为"进入某个分类刷"）
涉及仓库：后端 `job_hunt_back`（main 0a1c0b5）、学生端 `job_hunt_front`（main e3aa332）、管理端 `job_hunt_admin`（main d4a4efc）
素材：`中国华电27届公共与行业知识题库-答案对照表.xlsx`（`题目答案对照表` 工作表：`题号 / 题型 / 所属部分 / 题干 / A / B / C / D / 答案`，563 行）

## 1. 需求

- 题库按**公司**划分，公司下再分**分类**（如 中国华电 → 公共与行业知识；之后用户会补其他分类）。
- 题目有**题型**：单选（4 选 1）、多选（答案如 `ABC`）、判断（选项固定 正确 / 错误）；每题带**所属部分**（形势政策 / 企业文化 / 公司概况 / 新型电力系统 / 品牌建设…）。
- 学生端：先选公司 → 分类，进入分类后按题号顺序刷；每个分类各自记进度。不再有"今日一题 / 全库顺序"模式。
- 配额**全站共通、按作答计数**：游客累计可作答 20 道、免费账号 200 道、PRO 不限；超出后不能再作答（403），页面提示登录 / 升级。
- 后台：公司 / 分类管理；题目编辑支持三种题型；**按上述 xlsx 格式上传 Excel 导入到指定分类**。
- 本次把华电 563 题导入。

不做：按专业的考试大纲；分类下再分子分类（"所属部分"只是题目上的标签，可筛选）；按题授权（`AccessGrant{QUESTION}` 保留数据但不再影响配额）；错题本 / 打卡逻辑不变。

## 2. 数据模型（Prisma）

```prisma
model Company {
  id         String             @id @default(cuid())
  name       String             @unique
  sortOrder  Int                @default(0)
  createdAt  DateTime           @default(now())
  categories QuestionCategory[]
}

model QuestionCategory {
  id        String     @id @default(cuid())
  companyId String
  name      String
  sortOrder Int        @default(0)
  company   Company    @relation(fields: [companyId], references: [id], onDelete: Cascade)
  questions Question[]
  @@unique([companyId, name])
}

enum QuestionType { SINGLE MULTI JUDGE }

model Question {
  id          String           @id @default(cuid())
  categoryId  String
  type        QuestionType     @default(SINGLE)
  section     String?          // 所属部分
  sortOrder   Int              @default(0)   // 分类内顺序（导入时 = 题号）
  prompt      String
  options     Json             // [{ letter: "A", text }, …] 2–6 项；判断题固定 A 正确 / B 错误
  answer      String           // 已排序的字母串，如 "B" / "ABC"
  explanation String[]
  difficulty  Difficulty       @default(MEDIUM)
  source      String
  published   Boolean          @default(true)
  category    QuestionCategory @relation(fields: [categoryId], references: [id], onDelete: Cascade)
  attempts    Attempt[]
  wrongBook   WrongBookEntry[]
  @@index([categoryId, sortOrder])
}
```

删除 `CompanySet` 模型与 `Question.companySetId`。`Attempt.picked` 改存字母串（`"AC"`），语义同 `answer`。

迁移 `20260915090000_company_banks`（手写 SQL，保留现有数据）：
1. 建 `Company`，插入 `('company-general', '通用题库', 0)`。
2. `QuestionCategory` 加 `companyId`（先可空）→ 全部更新为 `company-general` → `SET NOT NULL`；删掉 `name` 唯一索引，建 `(companyId, name)` 唯一索引；加 `sortOrder`。
3. `Question` 加 `type`（默认 SINGLE）、`section`、`sortOrder`；用窗口函数按 `categoryId, id` 给现有题回填 `sortOrder`（1 起）；外键改 `ON DELETE CASCADE`；删 `companySetId` 列与外键；`DROP TABLE "CompanySet"`。
4. `ContentType` 枚举不动。

`prisma/seed.ts` / `quiz-data.ts`：去掉 `COMPANY_SETS`；分类 upsert 时带 `companyId: "company-general"`；`公司真题合集` 分类保留（题目不再关联公司题集）。

## 3. 后端契约与服务

### 3.1 共享 schema（`src/contract/quiz.ts`）

```ts
QuestionTypeSchema = z.enum(["SINGLE", "MULTI", "JUDGE"])               .openapi("QuestionType")
QuizOptionLetterSchema = z.enum(["A","B","C","D","E","F"])             .openapi("QuizOptionLetter")
QuizOptionSchema = { letter: QuizOptionLetterSchema, text: string.min(1) } .openapi("QuizOption")
quizOptionsSchema = z.array(QuizOptionSchema).min(2).max(6)  // 且 letter 必须是 A.. 连续、不重复（superRefine）
AnswerLettersSchema = z.string().regex(/^[A-F]+$/)                      // 已排序、无重复（superRefine）
QuizQuotaSchema = { tier: TierSchema, limit: int|null, used: int }      .openapi("QuizQuota")
```

判题规则（`src/lib/grade.ts`，纯函数，可测）：`normalizeAnswer(letters: string[]) → string`（去重、排序、拼接）；`grade(type, answer, picked: string[]) → boolean`：SINGLE / JUDGE 要求 `picked.length === 1` 且相等；MULTI 要求集合相等。校验规则 `validateQuestionShape(type, options, answer)`（导入与后台共用）：SINGLE 选项 2–6、答案 1 个字母且在选项内；MULTI 选项 3–6、答案 ≥ 2 个字母且都在选项内；JUDGE 选项恰好 `A 正确 / B 错误`（文案固定，导入时自动补齐）、答案 A 或 B。

### 3.2 学生端 `/api/quiz`

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/banks` | `QuizBanks = { companies: [{ id, name, categories: [{ id, name, total, answered, correct }] }], quota: QuizQuota }`。只含 `published` 题；`answered` = 该用户在该分类作答过的不同题数；`correct` = 其中最近一次作答正确的题数（简单起见按 attempt 里 `correct=true` 的不同题数）。空分类也列出。 |
| GET | `/categories/{categoryId}/next` | `QuizNext = { category: { id, name, company: string, total }, question: QuizQuestionPublic \| null, index: int, answered: int, exhausted: "QUOTA" \| "ALL" \| null }`。`question` = 该分类按 `sortOrder asc, id asc` 第一道该用户未作答的已发布题；`index` = 它在分类内的序号（1 起，用于"第 n / total 题"）；`exhausted`：无题时，若配额用尽 → `QUOTA`，否则 `ALL`。配额用尽时即使还有题也返回 `question: null, exhausted: "QUOTA"`。分类不存在 → 404。 |
| POST | `/attempts` | body `{ questionId, picked: QuizOptionLetter[] (min 1) }` → `QuizAnswerResult = { correct, answer: QuizOptionLetter[], explanation, accuracyRate }`。配额用尽 → `403 FORBIDDEN "作答次数已用完，登录或升级后继续"`；同一题重复作答允许（计入 attempt，但配额按**不同题数**计）。 |
| GET | `/dashboard` | `QuizDashboard = { streakDays, week, weekSolved, weekTarget, totalSolved, wrongList, quota }`（删 `categories`、`access`）。 |
| GET | `/wrong-book`、PUT `/wrong-book/{questionId}` | 不变（`title` 仍取题干前 24 字）。 |
| — | `/today`、`/company-sets` | **删除**。 |

`QuizQuestionPublic` 改为 `{ id, type, section: string|null, prompt, options, category, company, difficulty, source }`。

配额（`src/lib/access.ts`）：`Access.questions` 语义改为"累计可作答的不同题数上限"（GUEST 20 / FREE 200 / PRO null），`LIMITS` 数值不变；`usedQuota(userId)` = `attempt` 表该用户 `distinct questionId` 计数；ADMIN 不限。`Access.jobs` 与岗位窗口逻辑不变。

### 3.3 后台 `/api/admin`

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/quiz-meta` | `AdminQuizMeta = { companies: [{ id, name, sortOrder, categories: [{ id, name, sortOrder, questionCount, publishedCount }] }] }`（按 sortOrder, name 排序；替换原 categories/companySets） |
| POST | `/companies` | `{ name }` → 201 `AdminCompany { id, name, sortOrder }`；重名 400 |
| PATCH | `/companies/{id}` | `{ name?, sortOrder? }` → 204；重名 400；不存在 404 |
| DELETE | `/companies/{id}` | 204，级联分类与题目（及其作答 / 错题）；不存在 404 |
| POST | `/question-categories` | `{ companyId, name }` → 201 `AdminCategory { id, companyId, name, sortOrder }`；公司不存在 400；同公司重名 400 |
| PATCH | `/question-categories/{id}` | `{ name?, sortOrder? }` → 204 |
| DELETE | `/question-categories/{id}` | 204，级联题目 |
| POST | `/question-categories/{id}/import` | multipart `file`（xlsx，20 MB）→ 200 `AdminQuestionImportResult = { created, skipped: string[] }`。解析：找第一个表头含 `题干` 与 `答案` 的工作表；列按表头名取：`题号`（可选，作 sortOrder；缺省用行号）、`题型`（单选题 / 多选题 / 判断题；缺省按答案长度与选项数推断：2 个选项且文案为 正确/错误 → JUDGE，答案 ≥ 2 字母 → MULTI，否则 SINGLE）、`所属部分`（可选）、`题干`、`A`–`F`、`答案`。空白行跳过；不通过 `validateQuestionShape` 的行记入 `skipped`（"第 n 行：原因"）；同分类内题干完全相同的题跳过（"第 n 行：题干已存在"）。`source` = `${公司名} · ${分类名}`，`difficulty = MEDIUM`，`explanation = []`，`published = true`。整个导入在一个事务里。 |
| GET | `/questions` | query 加 `companyId?`, `type?`, `section?`；`categoryId?` 保留；排序 `sortOrder asc, id asc`；`AdminQuestion` 加 `type, section, sortOrder, companyId, companyName`，去掉 `companySetId`，`options` 2–6 项，`answer: string` |
| POST / PATCH | `/questions`, `/questions/{id}` | body 加 `type, section?: string|null, sortOrder?: int`，去掉 `companySetId`；`options` 2–6，`answer` 字母串；服务端用 `validateQuestionShape` 校验（400） |
| DELETE | `/questions/{id}` | 不变 |
| GET | `/summary` | 加 `companies` 计数 |

`scripts/import-questions.ts`：`pnpm db:import-questions <公司名> <分类名> <文件.xlsx>`——公司 / 分类不存在则创建，然后调同一个 `importQuestionWorkbook(categoryId, buffer)`。

## 4. 学生端 `job_hunt_front`

- `src/api/schema.d.ts` 重新生成；`types.ts` / `entities/quiz` 别名更新（`QuizBanks`, `QuizNext`, `QuizQuota`, `QuestionType`）；`queries.ts`：`quizBanksQuery()`、`quizNextQuery(categoryId)`（`staleTime: Infinity`，"下一题"时 `fetchQuery({ staleTime: 0 })`）、`quizDashboardQuery()`；删 `quizTodayQuery`、`companySetsQuery`；`useSubmitAttempt` body `{ questionId, picked: string[] }`。
- 路由：`/practice`（题库选择）与 `/practice/$categoryId`（刷题）。
- `/practice` 页（`views/practice/BankPickerPage.tsx`）：Navbar；主区按公司分组列出分类卡：分类名、`已答 x / 共 y`、进度条、按钮「开始 / 继续 / 已完成」→ `/practice/$categoryId`；右侧 `PracticeSidebar`（打卡 + 错题本；去掉"题库分类"段）。顶部若 `quota.limit !== null && quota.used >= quota.limit` 显示 `AccessBanner`。
- `/practice/$categoryId` 页（`views/practice/PracticePage.tsx`）：面包屑「题库 › 公司 · 分类」，`第 {index} / {total} 题`；`QuizQuestion` 支持三种题型：SINGLE / JUDGE 单选点击即选，MULTI 用多选（再点取消），提交按钮；揭晓后正确选项高亮、错选标记；「下一题」；`exhausted === "ALL"` → "本题库已全部答完" + 「返回题库」；`"QUOTA"` → `AccessBanner`。
- `AccessBanner` 的 questions 文案改为按配额：GUEST「未登录只能作答 {limit} 道题，已用 {used} 道」/「登录后可作答 200 道」；FREE「免费账号可作答 {limit} 道题，已用完」/「升级 PRO 不限次数」。`accessMessage()` 签名改为 `(input: { kind: "jobs", access } | { kind: "questions", quota })`，测试同步。
- 删除 `widgets/company-sets`。首页导航 `/practice` 不变。

## 5. 管理端 `job_hunt_admin`

- `schema.d.ts` 重新生成；`types.ts` 增删别名；`queries.ts`：`quizMetaQuery()` 形状变；`mutations.ts` 增 `useCreateCompany / usePatchCompany / useDeleteCompany / usePatchCategory / useDeleteCategory / useImportQuestions({ categoryId, file })`，`useCreateCategory` 参数改 `{ companyId, name }`；概览加「公司」卡。
- 题库页重构（`views/questions/`）：左栏"公司 / 分类"树（公司可新建 / 重命名 / 删除，分类可新建 / 重命名 / 删除 / **导入 Excel**；点击分类选中，URL `?categoryId=`），右侧题目表（列：序号、题型 Tag、所属部分、题干、状态、操作），筛选：题型、所属部分（输入）、状态、搜索。题目 Dialog：分类 select（公司 · 分类）、题型 select（切换到判断题时选项固定为 正确 / 错误 且不可编辑）、所属部分、题干、选项行（2–6，可增删，字母自动 A…），答案：单选 / 判断用 radio，多选用 checkbox；序号、难度、来源、解析、已发布。`question-form.ts` 的 `toQuestionBody` 按题型校验（文案：「至少两个选项」「多选题至少选两个正确答案」「请选择正确答案」）。
- 导入结果 Dialog：`created` + `skipped` 明细。

## 6. 测试

- 后端：`lib/grade.test.ts`（normalize / grade / validateQuestionShape 各题型边界）；`lib/import-questions.test.ts`（用 ExcelJS 内存生成含单选 / 多选 / 判断 / 缺题干 / 重复题干的表 → created / skipped）；`routes/quiz.test.ts` 重写：banks 进度、next 顺序与 index、多选判题（`["A","C"]` vs `"AC"` 正确，顺序无关）、判断题、配额：游客答 20 道不同题后 next 为 `QUOTA` 且第 21 题 403，重答已答题不计配额，登录后继续；`routes/admin.test.ts` 增：公司 / 分类增删改与重名、导入接口、题目 shape 校验 400、删除公司级联。
- 学生端：`access-message.test.ts` 更新；新增 `features/quiz-question/pick.ts` 纯函数 `togglePick(type, picked, letter)`（单选替换、多选切换）3 条。
- 管理端：`question-form.test.ts` 更新为按题型校验 5 条。
- 浏览器验收：管理端新建公司「中国华电」→ 分类「公共与行业知识」→ 上传 xlsx（created 563）；学生端游客进入该分类刷 20 道（含多选、判断）→ 出现配额提示；登录后继续。

## 7. 迁移与上线注意

- 迁移会删除 `CompanySet` 及其关联；现有题目全部归入「通用题库」公司。
- 华电题库通过后台上传导入（或 `pnpm db:import-questions 中国华电 公共与行业知识 <xlsx>`），xlsx 不入库。
