# 网课（课程目录 / 播放 / 学习进度 / 腾讯云 VOD）设计

日期：2026-09-17
状态：用户已确认（自录视频约 1 TB；网课按门单独收费；每门课的权限由管理端逐人开通；支付接入放到公司注册后；存储用腾讯云 VOD）
仓库：monorepo `/Users/black/Desktop/job_hunt`（main 45798b5）

## 1. 目标与边界

学生在学生端 `apps/web` 看课：课程目录 → 课程页（章 / 课时、进度）→ 播放页（HLS 播放、续播、倍速、自动下一节）→ 我的课程。管理端 `apps/admin` 管课程结构、上传视频、试看、定价、上下架、按人开通并看学习数据。视频存腾讯云 VOD（转码 HLS + CDN + 播放签名 + HLS 加密），后端只签名不中转。

不做：支付（保留价格与"联系开通"入口，后续接微信支付时只需"支付成功 → 写 `AccessGrant`"）；评论 / 弹幕 / 笔记；直播；小程序看课（后续）；PRO 档位不包含网课（网课独立于 PRO）。

## 2. 数据模型（Prisma）

```prisma
model Course {
  id            String          @id @default(cuid())
  title         String
  summary       String?                       // 一句话简介（目录卡片）
  description   String?                       // 详细介绍（课程页，支持换行）
  coverFileId   String?                       // VOD 图片 fileId，或直接存 coverUrl
  coverUrl      String?
  teacher       String?
  priceCents    Int             @default(0)    // 标价，分；0 = 免费课
  published     Boolean         @default(false)
  sortOrder     Int             @default(0)
  createdAt     DateTime        @default(now())
  updatedAt     DateTime        @updatedAt
  chapters      CourseChapter[]
  lessons       CourseLesson[]
  progresses    LessonProgress[]
}

model CourseChapter {
  id        String         @id @default(cuid())
  courseId  String
  title     String
  sortOrder Int            @default(0)
  course    Course         @relation(fields: [courseId], references: [id], onDelete: Cascade)
  lessons   CourseLesson[]
  @@index([courseId, sortOrder])
}

enum VideoStatus { NONE UPLOADING PROCESSING READY FAILED }

model CourseLesson {
  id              String         @id @default(cuid())
  courseId        String
  chapterId       String?
  title           String
  sortOrder       Int            @default(0)
  freePreview     Boolean        @default(false)   // 试看
  videoFileId     String?                          // 腾讯云 VOD FileId
  videoStatus     VideoStatus    @default(NONE)
  durationSeconds Int?                             // 转码完成后由 VOD 回调 / 查询回填
  course          Course         @relation(fields: [courseId], references: [id], onDelete: Cascade)
  chapter         CourseChapter? @relation(fields: [chapterId], references: [id], onDelete: SetNull)
  progresses      LessonProgress[]
  @@index([courseId, sortOrder])
}

model LessonProgress {
  userId          String
  lessonId        String
  courseId        String
  positionSeconds Int      @default(0)
  completed       Boolean  @default(false)
  updatedAt       DateTime @updatedAt
  user   User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  lesson CourseLesson @relation(fields: [lessonId], references: [id], onDelete: Cascade)
  course Course       @relation(fields: [courseId], references: [id], onDelete: Cascade)
  @@id([userId, lessonId])
  @@index([userId, courseId, updatedAt])
}
```

迁移 `20260917120000_online_courses`：`Course` 加 `summary / teacher / priceCents / sortOrder / coverFileId`；建 `CourseChapter`；`CourseLesson` 删 `videoUrl` / `durationMinutes`，加 `chapterId / freePreview / videoFileId / videoStatus / durationSeconds`（现有课时的 `videoUrl` 迁到一个临时列 `legacyVideoUrl` 保留，`videoStatus = NONE`；`durationMinutes*60 → durationSeconds`）；建 `LessonProgress`。`AccessGrant{COURSE}` 不变——就是"已开通"。

## 3. 腾讯云 VOD 接入（后端 `src/lib/vod.ts`）

环境变量：`VOD_SECRET_ID / VOD_SECRET_KEY / VOD_APP_ID / VOD_SUB_APP_ID?（可选）/ VOD_PLAY_KEY（播放密钥，控制台"超级播放器"里配）/ VOD_PLAY_DOMAIN（加速域名）/ VOD_CALLBACK_TOKEN`。SDK 用 `tencentcloud-sdk-nodejs-vod`。

- **上传签名**：`signUpload({ classId?, procedure })` → 客户端上传签名（VOD 官方算法：HMAC-SHA1 over query string，含 `secretId, currentTimeStamp, expireTime, random, procedure, sourceContext`），有效期 1 小时。`procedure` 指向控制台里预建的任务流（转码 HLS 720p/1080p + 加密 + 封面截图），名字放 `VOD_PROCEDURE`。管理端用 `vod-js-sdk-v6` 直传（浏览器 → COS），拿到 `fileId` 后 `PATCH /admin/lessons/{id}` 写 `videoFileId`、`videoStatus = PROCESSING`。
- **事件回调**：`POST /api/vod/callback`（无需登录，校验 `?token=VOD_CALLBACK_TOKEN`）；处理 `ProcedureStateChanged`：`Status == FINISH` → 找 `videoFileId` 对应课时，`videoStatus = READY`、回填 `durationSeconds`（`MetaData.Duration`）与封面；失败 → `FAILED`。回调不通时管理端有"刷新状态"按钮走 `DescribeMediaInfos`。
- **播放签名**：`signPlay(fileId, userId)` → 超级播放器签名（HMAC-SHA256 JWT：`appId, fileId, currentTimeStamp, expireTimeStamp(+2h), urlAccessInfo{t}, drmLicenseInfo?`）。学生端播放器（腾讯云 `tcplayer`，通过 `<script>` 引入或 npm `tcplayer.js`）用 `fileID + appID + psign` 播放，HLS 密钥由 VOD 的 key 服务按签名下发，浏览器拿不到裸 m3u8/ts 长期链接。
- 试看：同样签名，不区分；控制访问的是"要不要给你签名"。

## 4. 后端契约

### 4.1 学生端 `/api/courses`（`requestUser` 之后）

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/courses` | `CourseCatalog = { items: CourseCard[] }`；`CourseCard = { id, title, summary, coverUrl, teacher, priceCents, lessonCount, durationSeconds, freePreviewCount, access: "GRANTED" \| "PREVIEW" \| "LOCKED", progressPercent: int \| null }`。`access`：免费课（`priceCents=0`）或有未过期 grant 或 ADMIN → GRANTED；否则有试看课时 → PREVIEW；否则 LOCKED。只列 `published`。 |
| GET | `/courses/{id}` | `CourseDetail = { ...CourseCard, description, chapters: [{ id, title, lessons: Lesson[] }], unchaptered: Lesson[], lastLessonId: string \| null }`；`Lesson = { id, title, durationSeconds, freePreview, videoStatus, playable: boolean, progress: { positionSeconds, completed } \| null }`。`playable = videoStatus === "READY" && (access === "GRANTED" \|\| freePreview)`。未发布 → 404。 |
| GET | `/courses/{id}/lessons/{lessonId}/play` | `PlayInfo = { appId, fileId, psign, expiresAt, positionSeconds }`；不可播 → `403 FORBIDDEN "该课时需要开通课程后观看"`；视频未就绪 → `409 CONFLICT "视频处理中"`（`AppError` 状态加 409；`ApiErrorCode` 加 `CONFLICT`）。 |
| PUT | `/courses/{id}/lessons/{lessonId}/progress` | body `{ positionSeconds: int ≥ 0, completed?: boolean }` → 204；只有 `playable` 才接受；`completed` 由客户端在播放到 ≥ 90% 或 `ended` 时置 true，服务端只增不减（已完成不会因回看变未完成）。 |
| GET | `/me/courses` | `MyCourses = { items: [{ ...CourseCard, lastLessonId, lastLessonTitle, updatedAt }] }`：有 grant 或有进度的课，按最近学习排序。 |

`quota` / 档位与网课无关。游客也能看目录与试看（游客的进度写在游客用户上，登录合并时随 `AuthIdentity` 挂到同一 User，天然保留）。

### 4.2 管理端 `/api/admin`

- 课程：`GET /courses?q&published&page&pageSize`（分页；`AdminCourse` 加 `summary, teacher, priceCents, sortOrder, lessonCount, readyCount, grantCount`）、`GET /courses/{id}`（含 chapters / lessons 全量）、`POST /courses`（`{ title, summary?, description?, teacher?, priceCents, coverUrl?, published, sortOrder? }` → 201 `{id}`）、`PATCH /courses/{id}`、`DELETE /courses/{id}`（级联；同时删 `AccessGrant{COURSE,id}`）。**删除**旧的 `POST /content`（COURSE 分支）与 `AdminCourseBody`——资料仍走 `POST /content`（只剩 MATERIAL 分支，判别联合退化为单一 schema，改名 `AdminMaterialBody` 直接用）。
- 章：`POST /courses/{id}/chapters {title}` → 201、`PATCH /chapters/{id} {title?, sortOrder?}`、`DELETE /chapters/{id}`（课时 `chapterId → null`）。
- 课时：`POST /courses/{id}/lessons { title, chapterId?, freePreview? }` → 201 `{id}`、`PATCH /lessons/{id} { title?, chapterId?, sortOrder?, freePreview?, videoFileId? }`（写 `videoFileId` 时 `videoStatus = PROCESSING`）、`DELETE /lessons/{id}`、`PUT /courses/{id}/lessons/order { chapters: [{ id, lessonIds: string[] }], unchaptered: string[] }`（一次性写 sortOrder）、`POST /lessons/{id}/video/refresh`（查 VOD 回填状态）。
- 上传：`POST /vod/upload-signature` → `{ signature, expiresAt }`。
- 授权：沿用 `PUT /students/{id}/access`；新增 `GET /courses/{id}/students?page` → `{ items: [{ userId, name, phone, grantedAt, expiresAt, progressPercent, lastActiveAt }] }` 与 `POST /courses/{id}/grants { userIds: string[], expiresAt? }`（批量开通，幂等）、`DELETE /courses/{id}/grants/{userId}`。
- 概览 `summary` 加 `courses / readyLessons / courseGrants`。

### 4.3 学生端 `/api/content`

保留 `materials`；`courses` 字段删除（由 `/api/courses` 取代）。`StudentContent = { materials }`。

## 5. 学生端 `apps/web`

- 导航加「网课」→ `/courses`。
- `/courses`：`CourseCatalogPage`——卡片网格（封面 16:9、标题、讲师、课时数 · 总时长、右上角 Badge：免费 / ¥价格 / 已开通 / 可试看）；已开通的显示进度条。
- `/courses/$courseId`：`CoursePage`——头部（封面、标题、讲师、简介、价格 + 按钮：已开通 → 「继续学习」跳 `lastLessonId ?? 第一课时`；LOCKED / PREVIEW → 「¥xx · 联系开通」打开 `EnrollDialog`（文案："公司注册中，暂时通过微信联系开通：（待填写）；开通后刷新本页"）；章节列表：每课时行 = 序号、标题、时长、状态（✓ 已看完 / 进度% / 🔒 需开通 / 试看 / 处理中），可播的行是 `Link` 到播放页。
- `/courses/$courseId/$lessonId`：`PlayerPage`——左 `VideoPlayer`（`tcplayer` 封装：接收 `PlayInfo`，`currentTime = positionSeconds`；`timeupdate` 每 10 秒、`pause`、`beforeunload` 上报进度；`ended` 或 ≥90% 上报 `completed` 并自动跳下一可播课时）；右侧 `LessonList`（当前高亮）；下方标题、描述；不可播的课时点进来显示锁定 / 处理中面板。播放签名 2 小时过期：`expiresAt` 前 5 分钟静默重取。
- `/me/courses`：`MyCoursesPage`——列表 + 「继续学习」。
- `tcplayer` 的脚本与样式：`index.html` 引 CDN（`https://web.sdk.qcloud.com/player/tcplayer/release/v5.x/tcplayer.v5.x.min.js` + css），组件里 `window.TCPlayer`；类型声明放 `src/shared/vendor/tcplayer.d.ts`。
- 用 `@job-hunt/ui`：Badge、Button、ProgressBar、DialogShell、Kicker；卡片 / 列表样式用 Tailwind 类。

## 6. 管理端 `apps/admin`

- 「课程」页重做：列表（DataTable：标题、讲师、价格、课时 / 已就绪、已开通人数、状态、操作）→ 课程详情页 `/courses/$id`：
  - 基本信息表单（FormDialog / 或页内表单）：标题、简介、详细介绍、讲师、价格（元 → 分）、封面 URL、上架。
  - 结构编辑：章列表（新建 / 重命名 / 删除 / 拖拽或上下移）、章下课时（新建 / 重命名 / 删除 / 移动到章 / 上下移 / 试看开关）；课时行显示视频状态 Badge（未上传 / 上传中 x% / 处理中 / 就绪 · 时长 / 失败）与「上传视频」按钮（`vod-js-sdk-v6`：取上传签名 → 直传 → 进度 → 完成后 `PATCH /lessons/{id} { videoFileId }`）、「刷新状态」。
  - 学员：已开通列表（DataTable：姓名 / 手机、开通时间、到期、进度、最近学习）、「开通学员」对话框（手机号搜索选人，多选，到期日可选）、移除。
- 学生页的授权对话框：`COURSE` 类型的下拉沿用（数据源改 `GET /admin/courses`）。
- 概览加 3 张卡。

## 7. 测试

- 后端：`lib/vod.test.ts`（上传 / 播放签名纯函数用固定 secret 与时间戳做快照断言）；`routes/courses.test.ts`（目录 access 三态；详情 `playable`；play：LOCKED 403 / 试看 200 / 未就绪 409；progress 只增不减、不可播 403；`/me/courses` 排序；游客进度登录后保留）；`routes/admin.test.ts` 加课程 / 章 / 课时 / 排序 / 批量授权 / 删除级联；`routes/vod-callback.test.ts`（token 校验、FINISH 回填、FAILED）。
- 学生端：`views/courses/progress.ts` 纯函数（`shouldMarkCompleted(position, duration)`、`nextPlayableLesson(detail, currentId)`）测试；`format-duration` 测试。
- 管理端：`course-schema` / `lesson-schema` 测试；上传流程状态机 `upload-state.ts`（idle → signing → uploading(pct) → linking → done/failed）测试。
- 浏览器验收：无真实 VOD 凭据时后端 `VOD_MOCK=1` 返回假签名，播放器组件在 mock 下渲染一个 `<video>` 播放本地示例 mp4（`public/sample.mp4`，不入库，验收用）。真实联调需要用户提供腾讯云子账号密钥与已备案域名。

## 8. 上线前置（用户侧）

腾讯云开通 VOD → 建应用（拿 `VOD_APP_ID`）→ 建任务流（转码 HLS 720p + 1080p、HLS 标准加密、封面截图，记名到 `VOD_PROCEDURE`）→ 超级播放器签名开启并生成 `VOD_PLAY_KEY` → 加速域名绑定并备案 → 事件通知（回调地址 `https://<api 域名>/api/vod/callback?token=…`）→ 子账号 API 密钥（只授 VOD 权限）。这些写进 `apps/api/README.md`「网课 / VOD」一节。
