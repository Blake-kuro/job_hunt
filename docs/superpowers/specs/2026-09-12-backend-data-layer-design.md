# 后端数据层设计：岗位 / 用户 / 刷题

日期：2026-09-12
状态：待评审

## 1. 背景与目标

前端两个页面（岗位看板 `/`、刷题 `/practice`）目前全部靠 `src/entities/*/model/data.ts` 里写死的 mock 数据。本设计把数据接到 PostgreSQL，建立服务层与 REST 接口，并把页面切换到真实数据。

**目标**

- 岗位表：按用户已有的 Excel 数据结构落库，提供带筛选、排序、分页的列表，以及收藏 / 投递状态两个用户侧写操作
- 用户表：建表 + 一个种子开发账号；所有"属于某用户"的数据挂在它上面
- 刷题：题库、作答记录、错题本、打卡统计、公司题集
- 一套 REST 接口，页面自身和外部客户端共用
- Excel（`.xlsx`）导入脚本，可重复执行

**不做**

- 登录 / 注册 / 会话（留 `getCurrentUserId()` 一个接缝）
- 定时同步、爬虫对接、增量检测
- SWR / React Query 之类的客户端缓存层
- API 版本号、限流
- `.xls`（旧版二进制格式）、CSV

## 2. 技术选型

| 项 | 选择 | 说明 |
|---|---|---|
| 数据库 | PostgreSQL 16 | 本地用 docker-compose |
| ORM | Prisma | 用户指定 |
| 校验 | zod | 已在依赖里，此前未使用 |
| 测试 | vitest | 只测数据清洗函数 |
| 时区 | `Asia/Shanghai` | "今天"、"本周"的边界按此计算 |

## 3. 架构

```
Prisma ──▶ src/server/services/（纯函数，返回 DTO）──┬──▶ src/app/api/**/route.ts   ← 外部客户端、浏览器端写操作
                                                    └──▶ Server Component          ← 页面首屏直接调用，保住 SSR
```

- 业务逻辑只在 `services/` 写一遍
- Route Handler 是薄壳：zod 校验 → 调 service → JSON
- 页面首屏在服务端直接调 service，**不** fetch 自己的 `/api`
- 浏览器里的写操作（收藏、标记已投、提交答案、错题本）走 `fetch('/api/...')`，乐观更新，失败回滚

## 4. 数据模型

### 4.1 岗位（用户现有结构）

一行 = 一家公司的一则招聘公告，`position` 里是多个岗位。多值字段与截止日期都是自由文本，按原样存，另加两个派生列。

```prisma
model Job {
  id               Int       @id @default(autoincrement())
  serialNumber     String?
  categoryId       Int                 // 1 秋招与实习 · 2 央国企 · 3 外企
  recruitmentBatch String?             // 秋招 / 春招 / 实习
  enterpriseNature String?             // 民营企业 / 央国企 / 外企 ...
  industry         String?             // "/" 分隔
  workLocation     String?             // "、" 或空格分隔
  position         String              // "、" 分隔，多岗位
  graduationYear   String?             // "2027届" / "2026/2027届"
  degree           String?             // "本科及以上"；导入时从 graduationYear 单元格拆出
  announcementLink String?
  deliveryAddress  String?
  deadline         String?             // 原文："2026.11.30" / "尽快投递，招满即止"
  deadlineAt       DateTime? @db.Date  // 解析成功才填；排序与"剩 N 天"用它
  createTime       DateTime  @default(now())
  updateTime       DateTime  @updatedAt

  favorites    Favorite[]
  applications Application[]

  @@index([categoryId, deadlineAt])
  @@index([createTime])
}
```

`categoryId` 到中文的映射放在代码里（`src/server/lib/category.ts`），不建表：

```ts
export const CATEGORY = { 1: "秋招与实习", 2: "央国企", 3: "外企" } as const;
```

### 4.2 用户与用户侧关联

```prisma
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

model Favorite {
  userId String
  jobId  Int
  user   User @relation(fields: [userId], references: [id], onDelete: Cascade)
  job    Job  @relation(fields: [jobId],  references: [id], onDelete: Cascade)
  @@id([userId, jobId])
}

enum AppStatus { APPLIED INTERVIEWING }   // 已投递 / 面试中；无记录 = 未投递

model Application {
  userId    String
  jobId     Int
  status    AppStatus
  updatedAt DateTime @updatedAt
  user      User @relation(fields: [userId], references: [id], onDelete: Cascade)
  job       Job  @relation(fields: [jobId],  references: [id], onDelete: Cascade)
  @@id([userId, jobId])
}
```

"已截止"不是投递状态，由 `deadlineAt < today` 推导。

### 4.3 刷题

```prisma
enum Difficulty { EASY MEDIUM HARD }

model QuestionCategory {
  id        String     @id @default(cuid())
  name      String     @unique          // 言语理解与表达 / 计算机基础单选 / ...
  questions Question[]
}

model CompanySet {
  id        String     @id @default(cuid())
  company   String                      // 阿里巴巴
  track     String                      // 互联网 · 后端
  focus     String                      // JVM、MySQL 索引、分布式事务、场景设计题
  questions Question[]
}

model Question {
  id           String            @id @default(cuid())
  categoryId   String
  companySetId String?
  prompt       String
  options      Json              // [{ "letter": "A", "text": "..." }, ...] 固定 4 项
  answer       String            // "A" | "B" | "C" | "D"
  explanation  String[]          // 分段解析
  difficulty   Difficulty
  source       String            // 行测真题
  category     QuestionCategory  @relation(fields: [categoryId],   references: [id])
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
  user       User     @relation(fields: [userId],     references: [id], onDelete: Cascade)
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
  user         User     @relation(fields: [userId],     references: [id], onDelete: Cascade)
  question     Question @relation(fields: [questionId], references: [id], onDelete: Cascade)
  @@id([userId, questionId])
}
```

所有统计（连续打卡、本周格子、题数、正确率、分类题数）从 `Attempt` / `Question` 即时查询，不存冗余字段。

## 5. 数据清洗 `src/server/lib/parse.ts`

三个纯函数，导入脚本和服务层共用，是唯一需要单元测试的模块。

### `splitMulti(text: string | null): string[]`

按 `、` `，` `,` `/` `|` 和连续空白切分，去空、去重、trim。

| 输入 | 输出 |
|---|---|
| `"北京、上海、杭州、东莞、海外"` | `["北京","上海","杭州","东莞","海外"]` |
| `"昆山 厦门 黄石 成都"` | `["昆山","厦门","黄石","成都"]` |
| `"玩具/潮玩/文创设计"` | `["玩具","潮玩","文创设计"]` |
| `""` / `null` | `[]` |

### `parseDeadline(text: string | null): Date | null`

按顺序尝试；都不匹配返回 `null`。带年份的按原样解析。不带年份的先按当前年解析，若结果早于今天 180 天以上，改为次年（处理"11.30"这种跨年写法）。

| 输入 | 输出 |
|---|---|
| `"2026.11.30"` | 2026-11-30 |
| `"2026/11/30"` `"2026-11-30"` | 2026-11-30 |
| `"11.30"` `"11月30日"` | 当前年或次年的 11-30 |
| `"2026年11月30日"` | 2026-11-30 |
| `"尽快投递，招满即止"` | `null` |
| `"长期有效"` | `null` |
| `""` / `null` | `null` |

### `splitGradDegree(cell: string | null): { graduationYear: string | null; degree: string | null }`

按换行切分；含"届"的段是届别，含"及以上" / "本科" / "硕士" / "博士" / "不限"的段是学历。

| 输入 | 输出 |
|---|---|
| `"2027届\n\n本科及以上"` | `{ "2027届", "本科及以上" }` |
| `"2026/2027届\n\n本科及以上"` | `{ "2026/2027届", "本科及以上" }` |
| `"2027届"` | `{ "2027届", null }` |
| `"本科及以上"` | `{ null, "本科及以上" }` |
| `""` / `null` | `{ null, null }` |

## 6. 服务层 `src/server/services/`

### 6.1 通用

- `src/server/db.ts`：Prisma 单例（开发模式挂 `globalThis` 防热重载重复实例）
- `src/server/auth.ts`：`getCurrentUserId(): Promise<string>`。现在按 `email = "dev@local"` 查种子用户并返回 id，用 `React.cache` 做请求级缓存；查不到则抛错提示先跑 seed。做登录时只改这一个函数。

### 6.2 `jobs.ts`

```ts
type JobListQuery = {
  category?: 1 | 2 | 3;
  city?: string;          // 对 workLocation 做 contains
  q?: string;             // 对 enterpriseName / position / industry 做 contains（不区分大小写）
  sort: "deadline" | "posted";   // 默认 deadline
  page: number;           // 从 1 起，默认 1
  pageSize: number;       // 默认 20，上限 100
};

type JobListItem = {
  id: number;
  company: string;
  category: 1 | 2 | 3;
  categoryLabel: string;
  positions: string[];
  cities: string[];
  degree: string | null;
  industry: string | null;
  batch: string | null;
  graduationYear: string | null;
  deadlineText: string | null;
  deadlineAt: string | null;      // "YYYY-MM-DD"
  daysLeft: number | null;        // deadlineAt - today，可为负
  postedAt: string;               // "YYYY-MM-DD"
  announcementLink: string | null;
  deliveryAddress: string | null;
  starred: boolean;
  applicationStatus: "APPLIED" | "INTERVIEWING" | null;
};

listJobs(query, userId): Promise<{ items: JobListItem[]; total: number; page: number; pageSize: number }>
setFavorite(jobId, userId, starred: boolean): Promise<{ starred: boolean }>
setApplication(jobId, userId, status: AppStatus | null): Promise<{ applicationStatus: AppStatus | null }>
getProgress(userId): Promise<{
  starred: number; applied: number; interviewing: number;     // "我的进度"卡片
  newThisWeek: number; newInternshipsThisWeek: number;        // "本周新增"横幅；本周 = 本周一 00:00 起
  nextDeadline: { jobId: number; company: string; daysLeft: number } | null;   // 已收藏且未截止中最早的
}>
```

排序规则：`deadline` = `deadlineAt ASC NULLS LAST, createTime DESC`；`posted` = `createTime DESC`。

`jobId` 不存在 → 抛 `NotFoundError`（route 层转 404）。

### 6.3 `quiz.ts`

```ts
getTodayQuestion(userId): Promise<{
  question: { id, prompt, options, category, difficulty, source } | null;   // 不含 answer / explanation
  indexLabel: string;      // `试题 ${今日已答数 + 1} / 20`
  attemptedToday: number;
}>
```
返回该用户从未作答过的第一道题（按 `Question.id` 升序）；题库答完返回 `question: null`。

```ts
submitAnswer(userId, questionId, picked): Promise<{
  correct: boolean;
  answer: string;
  explanation: string[];
  accuracyRate: number | null;    // 全体用户该题正确率，百分数取整；无作答记录为 null
}>
```
写一条 `Attempt`；答错则 upsert `WrongBookEntry`（`nextReviewAt = 现在 + 1 天`，`mastered = false`）。

```ts
listWrongBook(userId): Promise<{ questionId; title; due: string }[]>
// mastered=false，按 nextReviewAt 升序；title 取 prompt 前 24 字；
// due："已到期"（nextReviewAt < 今天）/ "今天" / "明天" / "N 天后"

getDashboard(userId): Promise<{
  streakDays: number;        // 连续有作答的天数；今天有作答则以今天收尾，否则以昨天收尾，昨天也没有则为 0
  week: { label: "一"|"二"|"三"|"四"|"五"|"六"|"日"; done: boolean }[];   // 本周一到周日，done = 当天有作答
  weekSolved: number;        // 本周作答过的不同题目数
  weekTarget: 20;
  totalSolved: number;       // 历史作答过的不同题目数
  categories: { id; label; count }[];   // count = 该分类题目数
  wrongList: ReturnType<typeof listWrongBook>;   // 复用 listWrongBook
}>

setMastered(userId, questionId, mastered: boolean): Promise<void>
listCompanySets(): Promise<{ id; company; track; focus; count }[]>   // count = 挂在该题集下的题目数
```

### 6.4 `users.ts`

```ts
getCurrentUser(): Promise<{ id; email; name }>
```

## 7. REST 接口 `src/app/api/`

所有接口：JSON；请求体和 query 用 zod 校验；错误统一为
`{ "error": { "code": "VALIDATION" | "NOT_FOUND" | "INTERNAL", "message": string, "issues"?: ZodIssue[] } }`
状态码：200 成功、204 无内容、400 校验失败、404 不存在、500 未预期错误。目前无 401，但每个 handler 都调用 `getCurrentUserId()`。

| 方法 | 路径 | 请求 | 响应 |
|---|---|---|---|
| GET | `/api/jobs` | query: `category, city, q, sort, page, pageSize` | `listJobs` 返回值 |
| PUT | `/api/jobs/:id/favorite` | — | `{ starred: true }` |
| DELETE | `/api/jobs/:id/favorite` | — | `{ starred: false }` |
| PUT | `/api/jobs/:id/application` | `{ status: "APPLIED" \| "INTERVIEWING" }` | `{ applicationStatus }` |
| DELETE | `/api/jobs/:id/application` | — | `{ applicationStatus: null }` |
| GET | `/api/quiz/today` | — | `getTodayQuestion` 返回值 |
| POST | `/api/quiz/attempts` | `{ questionId, picked: "A"\|"B"\|"C"\|"D" }` | `submitAnswer` 返回值 |
| GET | `/api/quiz/dashboard` | — | `getDashboard` 返回值 |
| GET | `/api/quiz/wrong-book` | — | `{ items: wrongList }` |
| PUT | `/api/quiz/wrong-book/:questionId` | `{ mastered: boolean }` | 204 |
| GET | `/api/quiz/company-sets` | — | `{ items }` |
| GET | `/api/me` | — | `{ id, email, name }` |

## 8. 页面接入

### 8.1 岗位看板 `/`

- `src/app/page.tsx` 变为 `async` Server Component：读 `searchParams` → zod 解析成 `JobListQuery` → `listJobs()` → 传给 `JobBoardPage`
- **筛选状态从 `useState` 迁到 URL**：搜索、类型、城市、排序、页码都是 query 参数。修改筛选 = `router.replace` 带新 query（搜索框做 300ms 防抖）
- 类型筛选选项改为：全部 / 秋招与实习 / 央国企 / 外企
- 岗位名称列：显示前 3 个岗位，超出显示"等 N 个"，点击展开为完整列表；窄屏卡片同理
- 地点列显示 `cities.join(" · ")`；城市筛选 chips 保持固定六个，匹配按包含
- 学历要求列读 `degree`；去掉"内推"标签
- 截止列：`deadlineAt` 有值 → `MM-DD` + `剩 N 天` / `已截止`；无值 → 显示 `deadlineText` 原文
- 官方链接 → `announcementLink`（新标签打开）；操作列新增"去投递"链接 → `deliveryAddress`
- 收藏 / 标记已投：乐观更新 + `fetch('/api/jobs/:id/...')`，失败回滚并 `console.error`
- 分页：真实翻页，`total` 驱动页码
- "我的进度"卡片与"本周新增"横幅的数字来自 `getProgress(userId)`；实习数按 `recruitmentBatch` 含"实习"计。卡片里"下一个截止"取当前用户已收藏且 `deadlineAt >= 今天` 的岗位中最早的一条
- 顶栏"2027 届 · 秋招进行中"保持静态文案

### 8.2 刷题 `/practice`

- `src/app/practice/page.tsx` 变为 `async`：并行调用 `getTodayQuestion` / `getDashboard` / `listCompanySets`
- `QuizQuestion` 初始不知道答案；点"提交并查看答案" → `POST /api/quiz/attempts` → 用响应渲染解析。"收起解析"只是本地折叠
- "加入错题本"按钮去掉（答错自动加入）；"标记已掌握" → `PUT /api/quiz/wrong-book/:id { mastered: true }`；"下一题" → `router.refresh()`
- 题库答完时显示"今日题库已刷完"空状态

### 8.3 `src/entities/*/model/data.ts`

删除 mock 数据文件；类型定义改为从 service 的 DTO 导出。

## 9. 导入与种子

### 9.1 `scripts/import-jobs.ts`

```
npx tsx scripts/import-jobs.ts <file.xlsx>
```

- 用 `exceljs` 读取（新增 devDependency；选它而非 `xlsx` 是因为 npm 上的 `xlsx` 已停更）
- **读取工作簿内所有工作表**，每张表首行为表头，列名与 `Job` 字段同名（`id` 可选）；空行跳过
- 单元格取 `cell.text`，保留单元格内换行（届别和学历就是靠换行分在同一格里的）；日期类型的单元格转成 `YYYY/M/D` 文本后再走 `parseDeadline`
- `categoryId` 的来源，按优先级：
  1. 该行有 `categoryId` 列且值在 {1,2,3}
  2. 否则按工作表名推断：含"央国企"→ 2，含"外企"→ 3，含"秋招"或"实习"→ 1
  3. 都不满足则跳过该行并记录
- 每行：`splitGradDegree(graduationYear)` → `parseDeadline(deadline)`
- upsert 键：有 `id` 用 `id`；否则用 `serialNumber`；两者都无则插入
- 结束按工作表打印：`<表名>：新增 N · 更新 M · 跳过 K`，跳过的逐行给出行号和原因

### 9.2 `prisma/seed.ts`

- 用户：`{ email: "dev@local", name: "开发账号" }`
- 题库分类 5 个：言语理解与表达、计算机基础单选、算法概念选择题、行为面情景选择、公司真题合集
- 公司题集 4 个：阿里巴巴 / 腾讯 / 字节跳动 / 华为（文案沿用现有 mock）
- 题目 10 道，含现有 mock 里那道言语理解题；其余分布到各分类与题集
- 岗位不放种子

## 10. 环境与命令

```
docker-compose.yml        postgres:16，端口 5432，库名 job_hunt
.env.example              DATABASE_URL=postgresql://postgres:postgres@localhost:5432/job_hunt
```

package.json 新增脚本：

```
"db:up":      "docker compose up -d"
"db:migrate": "prisma migrate dev"
"db:seed":    "prisma db seed"
"db:import":  "tsx scripts/import-jobs.ts"   # 参数：xlsx 路径
"test":       "vitest run"
```

新增依赖：`@prisma/client`、`prisma`（dev）、`exceljs`（dev）、`tsx`（dev）、`vitest`（dev）。

## 11. 测试与验收

**单元测试**（vitest）：`src/server/lib/parse.test.ts`，覆盖第 5 节全部用例。

**验收步骤**：

```bash
npm run db:up && npm run db:migrate && npm run db:seed
npm run db:import -- ./data/jobs.xlsx         # 用户提供的文件
npm run dev

curl 'localhost:3000/api/jobs?category=1&sort=deadline&page=1' | jq '.total, .items[0]'
curl -X PUT localhost:3000/api/jobs/1/favorite
curl -X PUT localhost:3000/api/jobs/1/application -H 'content-type: application/json' -d '{"status":"APPLIED"}'
curl localhost:3000/api/quiz/today
curl -X POST localhost:3000/api/quiz/attempts -H 'content-type: application/json' -d '{"questionId":"<id>","picked":"B"}'
curl localhost:3000/api/quiz/dashboard | jq '.streakDays, .wrongList'
curl 'localhost:3000/api/jobs?page=abc'        # 期望 400
```

浏览器：`/` 三个断点下筛选、翻页、收藏、标记已投；`/practice` 答题 → 解析 → 标记已掌握 → 下一题。

## 12. 文件清单

新增：
```
docker-compose.yml
.env.example
prisma/schema.prisma
prisma/seed.ts
scripts/import-jobs.ts
src/server/db.ts
src/server/auth.ts
src/server/lib/category.ts
src/server/lib/parse.ts
src/server/lib/parse.test.ts
src/server/lib/http.ts                 ← route 共用：错误转换、JSON 响应
src/server/services/jobs.ts
src/server/services/quiz.ts
src/server/services/users.ts
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

修改：`package.json`、`src/app/page.tsx`、`src/app/practice/page.tsx`、`src/views/job-board/JobBoardPage.tsx`、`src/views/practice/PracticePage.tsx`、`src/features/job-filters/JobFilters.tsx`、`src/features/quiz-question/QuizQuestion.tsx`、`src/widgets/job-table/JobTable.tsx`、`src/widgets/progress-card/ProgressCard.tsx`、`src/widgets/practice-sidebar/PracticeSidebar.tsx`、`src/widgets/company-sets/CompanySets.tsx`、`src/entities/job/*`、`src/entities/quiz/*`

删除：`src/entities/job/model/data.ts`、`src/entities/quiz/model/data.ts`
