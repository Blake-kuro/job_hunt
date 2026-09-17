# job_hunt API

本项目位于 monorepo 的 `apps/api`。依赖统一在仓库根目录安装；下文应用命令在本目录执行，或使用根目录的 `pnpm --filter job-hunt-back <命令>`。

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
- OpenAPI 3.1：http://localhost:3001/api/openapi.json ，同一份提交在本应用目录 `openapi.json`

## 契约

`openapi.json` 是对外契约。改了路由或 `src/contract` 后运行 `pnpm openapi` 重新生成并一起提交；`pnpm test` 会先校验生成结果与提交文件一致（`openapi:check`）。

前端 / 其他项目消费方式：`openapi-typescript openapi.json -o schema.d.ts`，或任何 OpenAPI 客户端生成器。

## 约定

- 手机号验证码免密登录；验证成功后自动注册，使用 HttpOnly Cookie 保存 30 天会话。
- 开发环境会在后端日志和发送接口的 `developmentCode` 字段显示验证码；生产环境接入短信服务商前会拒绝发送。
- 登录身份独立保存，已预留 `WECHAT` / `QQ` 类型，后续可将扫码身份绑定到同一用户。
- 管理后台见下文「后台管理」一节。
- 学习资料接口只返回已发布且仍在授权有效期内的资料；网课见下文「网课 / VOD」；刷题配额见下文「刷题 API 与配额」。
- 错误统一 `{ error: { code, message, issues? } }`，包括参数、登录态、验证码及频控错误。
- 跨域：`CORS_ORIGINS` 逗号分隔；前端走 Vite 代理时不需要。
- 时区 Asia/Shanghai：日期边界只经 `src/lib/dates.ts`。
- 三档访问：游客（device Cookie 匿名建档）看岗位前 20 条 / 累计可作答 20 道题；手机号登录后 100 条 / 200 道；PRO 无限制。手动开通：`pnpm set-plan <手机号> PRO [天数]`（不填天数为永久；`FREE` 取消）。

## 刷题 API 与配额

题库三层：**公司 → 分类 → 题目**（`Company` / `QuestionCategory` / `Question`）。题目有题型 `type`（`SINGLE` 单选 / `MULTI` 多选 / `JUDGE` 判断，判断题选项固定 A 正确 / B 错误）、可选的 `section`（所属部分标签）与分类内顺序 `sortOrder`；`options` 为 2–6 个 `{ letter, text }`，`answer` 是已排序的字母串（如 `"B"`、`"AC"`）。判题与形状校验都在 `src/lib/grade.ts`。种子数据把 20 道示例题放在「通用题库」公司下。

- `GET /api/quiz/banks` 公司 → 分类列表（只计已发布题），每个分类带 `total / answered / correct`，外加当前用户 `quota`
- `GET /api/quiz/categories/{categoryId}/next` 该分类按 `sortOrder, id` 第一道未作答题，`index` 为它在分类内的序号（1 起）；无题时 `question: null`，`exhausted` 为 `QUOTA`（配额用尽）或 `ALL`（已答完）；分类不存在 404
- `POST /api/quiz/attempts` body `{ questionId, picked: ["A", "C"] }`；多选按集合判等（顺序无关），单选 / 判断要求恰好选一个；返回 `{ correct, answer: [...], explanation, accuracyRate }`；配额用尽作答新题 → 403 `FORBIDDEN`
- `GET /api/quiz/dashboard` 打卡 / 本周 / 累计 / 错题 + `quota`
- `GET /api/quiz/wrong-book`、`PUT /api/quiz/wrong-book/{questionId}` 错题本

配额 `quota = { tier, limit, used }` **全站共通、按作答过的不同题数计**：`used` = 该用户 `Attempt` 里去重后的题数；`limit` 为档位上限（游客 20 / 登录 200 / PRO 与管理员 `null`）。重复作答已答过的题不占配额，也不会被 403。按题授权（`AccessGrant{ QUESTION }`）数据保留但不再影响配额。

## 后台管理

管理员由 `ADMIN_PHONE_NUMBERS`（逗号分隔手机号）在登录时提升为 `ADMIN`（只升不降）；`/api/admin/*` 要求 `ADMIN` 角色，其余用户 403。管理端目录：`../admin`。

- `GET /api/admin/summary` 概览计数（学生 / 启用 / PRO / 游客 / 岗位 / 公司 / 题目 / 已发布题目 / 资料 / 课程 / 已就绪课时 / 课程授权）
- `GET /api/admin/students?q&plan&enabled&page&pageSize` 学生分页列表（有手机号的用户），含档位、统计与授权内容标题
- `PATCH /api/admin/students/{id}` 修改姓名 / 启用 / 套餐 / PRO 到期（管理员账号 403）
- `PUT /api/admin/students/{id}/access` 整体替换授权（内容不存在 400）
- `GET /api/admin/materials` 全部资料
- `POST /api/admin/content` 创建 / 更新资料（body `AdminMaterialBody`，带 `id` 为更新），返回 `201 { id }`；课程走下面的 `/courses`
- `DELETE /api/admin/content/MATERIAL/{id}` 删除资料，并清理对应授权
- `GET /api/admin/courses?q&published&page&pageSize` 课程分页列表（按 `sortOrder, createdAt desc`），每门含 `lessonCount / readyCount / grantCount`
- `GET /api/admin/courses/{id}` 课程详情：`chapters[].lessons` 与 `unchaptered`（课时含 `videoFileId / videoStatus / durationSeconds`）
- `POST /api/admin/courses` body `{ title, summary?, description?, teacher?, priceCents, coverUrl?, published, sortOrder? }` → `201 { id }`
- `PATCH /api/admin/courses/{id}` 只写提供的字段，`null` 清空（不存在 404）
- `DELETE /api/admin/courses/{id}` 级联章 / 课时 / 进度，事务里清理 `AccessGrant{COURSE}`
- `POST /api/admin/courses/{id}/chapters` body `{ title }` → `201 { id }`（排在最后）
- `PATCH /api/admin/chapters/{id}` `{ title?, sortOrder? }`；`DELETE /api/admin/chapters/{id}` 删章，课时回到无章
- `POST /api/admin/courses/{id}/lessons` body `{ title, chapterId?, freePreview? }` → `201 { id }`（排在最后；章不属于该课 400）
- `PATCH /api/admin/lessons/{id}` `{ title?, chapterId?, sortOrder?, freePreview?, videoFileId? }`；写 `videoFileId` 即置 `videoStatus = PROCESSING` 并清空时长
- `DELETE /api/admin/lessons/{id}` 删课时（级联进度）
- `PUT /api/admin/courses/{id}/lessons/order` body `{ chapters: [{ id, lessonIds }], unchaptered }` 一次性写章顺序与课时归属 / 顺序；必须恰好覆盖全部课时，否则 400
- `POST /api/admin/lessons/{id}/video/refresh` 查 VOD 媒体信息回填状态 / 时长，返回课时（没有 `videoFileId` 400；mock 下 READY / 600 秒）
- `POST /api/admin/vod/upload-signature` → `{ signature, expiresAt }`（客户端直传签名，1 小时；mock 为 `mock-upload`）
- `GET /api/admin/courses/{id}/students?page&pageSize` 已开通学员：`userId / name / phone / grantedAt / expiresAt / progressPercent / lastActiveAt`（含已过期授权）
- `POST /api/admin/courses/{id}/grants` body `{ userIds, expiresAt? }` 批量开通，幂等：已有授权只在传了 `expiresAt` 时更新到期（学生不存在 400）
- `DELETE /api/admin/courses/{id}/grants/{userId}` 移除授权（不存在 404）
- `GET /api/admin/quiz-meta` 公司 → 分类树（含题量 / 已发布题量）
- `GET /api/admin/questions?q&companyId&categoryId&type&section&published&page&pageSize` 题目分页列表（按 `sortOrder, id`），含公司名 / 分类名 / 题型 / 选项 / 答案
- `POST /api/admin/questions` 创建题目，返回 `201 { id }`（分类不存在或题型 / 选项 / 答案形状不合法 400）
- `PATCH /api/admin/questions/{id}` 修改题目（校验合并后的题型 / 选项 / 答案；题目不存在 404）
- `DELETE /api/admin/questions/{id}` 删除题目并清理对应授权
- `POST /api/admin/companies` body `{ name }` 创建公司，返回 `201 { id, name, sortOrder }`（重名 400）
- `PATCH /api/admin/companies/{id}` 修改公司名 / 排序（重名 400；不存在 404）
- `DELETE /api/admin/companies/{id}` 删除公司，级联分类、题目及其作答 / 错题（不存在 404）
- `POST /api/admin/question-categories` body `{ companyId, name }` 创建分类，返回 `201 { id, companyId, name, sortOrder }`（公司不存在 / 同公司下同名 400）
- `PATCH /api/admin/question-categories/{id}` 修改分类名 / 排序（同公司下重名 400；不存在 404）
- `DELETE /api/admin/question-categories/{id}` 删除分类，级联题目（不存在 404）
- `POST /api/admin/question-categories/{id}/import` 上传 xlsx（`multipart/form-data` 的 `file` 字段，≤ 20 MB）导入题目到该分类，返回 `{ created, skipped: string[] }`（无法解析或超限 400；分类不存在 404），列说明见下文「题库导入」
- `GET /api/admin/jobs?q&category&page&pageSize` 岗位分页列表（按创建时间倒序，含收藏 / 投递计数）
- `POST /api/admin/jobs` 创建岗位，返回 `201 { id }`
- `PATCH /api/admin/jobs/{id}` 修改岗位（只写提供的字段，`null` 清空；不存在 404）
- `DELETE /api/admin/jobs/{id}` 删除岗位（收藏 / 投递级联删除；不存在 404）
- `POST /api/admin/jobs/import` 上传 xlsx（`multipart/form-data` 的 `file` 字段，≤ 20 MB）导入岗位，返回各工作表新增 / 更新 / 跳过明细（无法解析或超限 400）

## 网课 / VOD

课程结构 **课程 → 章（可无）→ 课时**（`Course` / `CourseChapter` / `CourseLesson`），视频存腾讯云 VOD，后端只负责签名与状态回填，不中转视频。课程按门收费：`priceCents = 0` 为免费课，否则由管理端逐人开通（`AccessGrant{ COURSE }`）；学习进度 `LessonProgress` 按用户 × 课时记录，游客也能试看并记进度，手机号登录合并后保留。

学生端（`requestUser` 之后，游客可访问）：

- `GET /api/courses` 已发布课程目录，每张卡片带 `access`（`GRANTED` 免费 / 已开通 / 管理员；`PREVIEW` 有试看课时；`LOCKED`）与 `progressPercent`
- `GET /api/courses/{id}` 课程详情：章 / 课时、每课时 `playable`（`videoStatus === "READY"` 且已开通或试看）与进度、`lastLessonId`；未发布 404
- `GET /api/courses/{id}/lessons/{lessonId}/play` 播放签名 `{ appId, fileId, psign, expiresAt, positionSeconds }`；无权 403 `FORBIDDEN`，视频未就绪 409 `CONFLICT`
- `PUT /api/courses/{id}/lessons/{lessonId}/progress` body `{ positionSeconds, completed? }` → 204；只接受可播课时；`completed` 只增不减
- `GET /api/me/courses` 有授权或有进度的课程，按最近学习排序
- `POST /api/vod/callback?token=…` 腾讯云事件通知（无需登录，在 `requestUser` 之前），处理 `ProcedureStateChanged`：`FINISH` → 课时 `READY` 并回填时长 / 封面，失败 → `FAILED`

环境变量（`.env.example` 有注释）：

| 变量 | 说明 |
|---|---|
| `VOD_MOCK` | `1` 走 mock：上传签名 `mock-upload`、播放签名 `mock-play`、媒体信息直接 READY / 600 秒；非生产环境缺少 `VOD_SECRET_ID` 时也自动 mock。**生产环境（`NODE_ENV=production`）缺配置直接抛错，不会隐式 mock；显式 `VOD_MOCK=1` 也会抛错拒绝启动签名，回调也不接受 `mock-callback`。** `.env.example` 里默认是注释掉的，本地无凭据时手动打开。测试固定 mock |
| `VOD_SECRET_ID` / `VOD_SECRET_KEY` | 子账号 API 密钥（只授 VOD 权限），用于上传签名与 `DescribeMediaInfos` |
| `VOD_APP_ID` / `VOD_SUB_APP_ID` | VOD 应用 id；子应用可选 |
| `VOD_PLAY_KEY` | 超级播放器签名密钥（控制台「超级播放器」里生成） |
| `VOD_PLAY_DOMAIN` | 播放加速域名（已备案） |
| `VOD_PROCEDURE` | 上传后自动执行的任务流名称 |
| `VOD_CALLBACK_TOKEN` | 事件通知回调地址里的 `?token=`；mock 且未配置时接受 `mock-callback` |

签名实现在 `src/lib/vod.ts`：上传签名为 VOD 官方算法（`base64(HMAC-SHA1(secretKey, query) + query)`，1 小时），播放签名为 HS256 JWT（`appId, fileId, currentTimeStamp, expireTimeStamp, urlAccessInfo.t`，2 小时）；纯函数 `buildUploadSignature` / `buildPlaySignature` 有固定输入快照测试。

上线前置（用户侧，按顺序）：

1. 腾讯云开通 VOD，建应用，记下 `VOD_APP_ID`
2. 建任务流：转码 HLS 720p + 1080p、HLS 标准加密、封面截图；名称填到 `VOD_PROCEDURE`
3. 「超级播放器」开启播放签名并生成密钥 → `VOD_PLAY_KEY`
4. 绑定加速域名并备案 → `VOD_PLAY_DOMAIN`
5. 事件通知：回调模式，地址 `https://<api 域名>/api/vod/callback?token=<VOD_CALLBACK_TOKEN>`
6. 建子账号并只授 VOD 权限，生成 API 密钥 → `VOD_SECRET_ID` / `VOD_SECRET_KEY`
7. 申请播放器 License：腾讯云控制台「云点播 → 播放器 SDK → License 管理」申请 Web 播放 License（绑定学生端域名），把 License URL 填到 `apps/web` 的 `VITE_TCPLAYER_LICENSE_URL`（TCPlayer v5 不传 `licenseUrl` 会初始化失败、不出画面）
8. 生产环境确认没有 `VOD_MOCK`（`NODE_ENV=production` 且 `VOD_MOCK=1` 会直接抛错）

`pnpm db:seed` **只在 `VOD_MOCK=1` 时**种一门免费示例课 `course-sample-free`（2 章 3 课时，`videoFileId` 为 `mock-1/2/3`，`published: true`），否则跳过并打印一行说明——真实 VOD 下这门课无法播放，不应出现在生产目录里。用户 / 题库 seed 不受影响，全部 `upsert` 幂等。

### 真实联调待确认清单

以下实现按腾讯云文档编写，**尚未用真实凭据验证**，第一次真实联调时逐条确认：

1. **上传签名与子应用**：配置了 `VOD_SUB_APP_ID` 时，上传签名的 query 需要带 `vodSubAppId`；当前 `buildUploadSignature` 没有加这个参数，子应用场景下上传可能落到主应用。`fetchMediaInfo` 已按 `SubAppId` 查询。
2. **`VOD_APP_ID` 与 `VOD_SUB_APP_ID` 的关系**：播放签名 payload 的 `appId` 与前端 `TCPlayer({ appID })` 目前都用 `VOD_APP_ID`；如果视频存在子应用里，需确认两者应填主应用 id 还是子应用 id。
3. **回调 body 形状**：`POST /api/vod/callback` 按 `EventType === "ProcedureStateChanged"`、`ProcedureStateChangeEvent.FileId / Status`、封面从 `MediaProcessResultSet[].CoverBySnapshotTask.Output.CoverUrl` 取；时长从 `MetaData.Duration`。真实回调字段以控制台「事件通知」实际推送为准，若形状不符只会把课时留在 `PROCESSING`，可用管理端「刷新状态」兜底。
4. **`mediaInfoToStatus` 的 READY 判定**：`DescribeMediaInfos` 有非原片（`Definition !== 0`）的转码输出或自适应码流才算 READY；若任务流只做加密 HLS 而不产生 `TranscodeSet`，需要改判定。查不到 fileId 时当前返回 `FAILED`（刚上传完立即刷新可能误判，见评审建议）。
5. **HLS 标准加密 + `psign`**：TCPlayer 拿 `fileID + appID + psign` 播加密 HLS 的实际表现（key 请求、防盗链）未验证。
6. **管理端浏览器直传**：`apps/admin` 的 `vod-js-sdk-v6` 真实分支（`getSignature` 返回后端 `mock-upload` 以外的签名）未在浏览器里跑过，只验证过 mock 分支。
7. **预留未使用**：`VOD_PLAY_DOMAIN` 与 `Course.coverFileId` 目前代码里没有任何引用——前者留给自定义播放域名（需要时传给 TCPlayer），后者留给课程封面走 VOD；接入前可以忽略。

## 迁移说明

2026-09-15 把 `20260914064333_access_tiers` 改名为 `20260914093000_access_tiers`（它依赖更晚的 `phone_auth` 建的枚举，全新库按文件名顺序 `migrate deploy` 会失败）。**在改名之前已经跑过迁移的库**（本机开发库 / 测试库、已建好的线上库）执行一次即可：

```sql
UPDATE "_prisma_migrations" SET migration_name = '20260914093000_access_tiers' WHERE migration_name = '20260914064333_access_tiers';
```

全新的库不需要任何操作。

## 测试

集成测试打真库且会清空业务表，只接受以 `_test` 结尾的 `TEST_DATABASE_URL`：

```bash
docker compose exec db createdb -U postgres job_hunt_test
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/job_hunt_test pnpm exec prisma migrate deploy
pnpm test
```

## Excel 导入

多工作表；表名含"秋招/实习"→分类 1，"央国企/国企"→2，"外企"→3。有 `id` 列按 id upsert，否则按 `serialNumber`，再否则插入。按 id 写入过时会自动同步 `Job.id` 的自增序列，不再需要手动执行 `setval`。

导入逻辑在 `src/lib/import-jobs.ts`（`importWorkbook`），两种入口：

- 命令行：`pnpm db:import -- <文件.xlsx>`
- 后台：`POST /api/admin/jobs/import` 上传文件，管理端可直接操作

## 题库导入

一个 xlsx 导入到一个分类（公司 → 分类 → 题目）。取第一张表头同时含 `题干` 与 `答案` 的工作表，第一行为表头，列按名称取（顺序无关）：

| 列 | 说明 |
|---|---|
| `题号` | 可选；正整数时作为分类内顺序 `sortOrder`，否则用行号 − 1 |
| `题型` | 可选；`单选题` / `多选题` / `判断题`（也接受 `单选` / `多选` / `判断`）。缺省推断：两个选项且文案为 正确 / 错误 → 判断题，答案 ≥ 2 个字母 → 多选题，否则单选题 |
| `所属部分` | 可选；题目标签，可在后台按此筛选 |
| `题干` | 必填；空则跳过该行（整行空白不计入跳过明细） |
| `A` … `F` | 选项内容；必须从 A 起连续填写，中间有空列（如 A、C 有值 B 空）该行跳过「选项列不连续」，不会重赋字母。判断题忽略这些列，固定为 A 正确 / B 错误 |
| `答案` | 必填；全角自动转半角，只保留 A–F 字母（不区分大小写、分隔符随意），如 `A、C` → `AC`。判断题另接受 `对 / 错`、`正确 / 错误`、`√ / ×`、`T / F`（→ A / B） |

每行经 `validateQuestionShape` 校验（选项 2–6、单选 / 判断一个答案、多选至少 3 个选项 2 个答案等），不通过的记入 `skipped`（"第 n 行：原因"）；同分类内题干完全相同的行跳过（"第 n 行：题干已存在"），所以同一文件可以反复导入。写入的题目 `source = 公司名 · 分类名`、`difficulty = MEDIUM`、`explanation = []`、`published = true`，整个导入在一个事务里。

导入逻辑在 `src/lib/import-questions.ts`（`importQuestionWorkbook(categoryId, buffer)`），两种入口：

- 命令行：`pnpm db:import-questions <公司名> <分类名> <文件.xlsx>`（公司 / 分类不存在则创建）
- 后台：`POST /api/admin/question-categories/{id}/import` 上传文件，管理端可直接操作
