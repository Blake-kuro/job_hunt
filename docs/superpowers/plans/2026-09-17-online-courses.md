# 网课实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 学生端看课（目录 / 课程页 / HLS 播放 / 进度 / 我的课程），管理端管课（章 → 课时、腾讯云 VOD 直传、试看、定价、按人开通、学习数据），后端接 VOD 签名与回调。

**Architecture:** 视频只存腾讯云 VOD；后端 `src/lib/vod.ts` 负责上传签名 / 播放签名 / 状态查询，`VOD_MOCK=1` 时返回假签名以便无凭据开发与测试。学生端播放器封装 `tcplayer`，mock 下退化为 `<video src=sample.mp4>`。权限 = `Course.priceCents === 0` 或 `AccessGrant{COURSE}` 或 ADMIN；试看课时对所有人开放。

**Tech Stack:** Prisma 7、Hono + @hono/zod-openapi、`tencentcloud-sdk-nodejs-vod`、React 19 + TanStack Router / Query + `@job-hunt/ui`、`tcplayer`（CDN）、`vod-js-sdk-v6`、vitest、Biome。

**Spec:** `docs/superpowers/specs/2026-09-17-online-courses-design.md`

## Global Constraints

- monorepo `/Users/black/Desktop/job_hunt`，分支 `feat/online-courses`（基线 main 45798b5）。命令前 `source ~/.nvm/nvm.sh && nvm use`；根目录 `pnpm install`。
- 后端任务结束前 `apps/api` 下 `pnpm openapi && git add openapi.json && pnpm typecheck && pnpm lint && pnpm test`；根目录 `pnpm gen:api` 同步 `packages/api-client/src/schema.d.ts` 与小程序 schema（一起提交）。测试库迁移：`DATABASE_URL=<TEST_DATABASE_URL> pnpm exec prisma migrate deploy`。不要停 / 启 PostgreSQL。
- 前端任务结束前根目录 `pnpm typecheck && pnpm lint && pnpm test && pnpm build`。
- 通用组件只用 `@job-hunt/ui`；不在应用里新建通用组件；内联 `style` 只允许动态尺寸。表单用 `FormDialog` + react-hook-form + zod。
- 不提交 `.env*`（`.env.example` 除外）、`dist`、`node_modules`、`src/generated`、示例视频 `apps/web/public/sample.mp4`（加进 `.gitignore`）。
- `AppError` 状态加 `409`，`ApiErrorCodeSchema` 加 `CONFLICT`。
- 提交信息中文 Conventional 前缀，结尾一行 `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`。不 push。
- 不要启动 / 停止 3000 / 3001 / 5173 / 5174；验证用后端 3012（`VOD_MOCK=1 PORT=3012 pnpm dev`）、web 5175、admin 5177，只停自己起的。

---

### Task 1（后端）: 数据模型、VOD 库、回调、学生端课程 API

**Files:**
- Modify: `apps/api/prisma/schema.prisma`, `apps/api/prisma/seed.ts`（种一门免费示例课：2 章 3 课时，`videoStatus READY`、`videoFileId "mock-1"…`；仅 `VOD_MOCK` 语义，seed 不依赖 VOD）, `apps/api/.env.example`, `apps/api/package.json`（`tencentcloud-sdk-nodejs-vod`）, `apps/api/src/contract/{common,admin,content}.ts`, `apps/api/src/lib/errors.ts`, `apps/api/src/app.ts`, `apps/api/src/routes/content.ts`, `apps/api/src/routes/admin/{content,students}.ts`（最小适配：课程列表读新字段；`contentTitles` 不变）, `apps/api/src/test/db.ts`（TRUNCATE 加 `LessonProgress, CourseChapter`）, `apps/api/README.md`
- Create: `apps/api/prisma/migrations/20260917120000_online_courses/migration.sql`, `apps/api/src/lib/vod.ts`, `apps/api/src/lib/vod.test.ts`, `apps/api/src/contract/course.ts`, `apps/api/src/services/courses.ts`, `apps/api/src/routes/courses.ts`, `apps/api/src/routes/courses.test.ts`, `apps/api/src/routes/vod-callback.ts`, `apps/api/src/routes/vod-callback.test.ts`

**Interfaces（Produces）:**
- `src/lib/vod.ts`：`isMock()`；`signUpload(): { signature: string; expiresAt: string }`；`signPlay(fileId: string): { appId: string; fileId: string; psign: string; expiresAt: string }`；`fetchMediaInfo(fileId): Promise<{ status: "PROCESSING"|"READY"|"FAILED"; durationSeconds: number|null; coverUrl: string|null }>`；`verifyCallbackToken(token)`。mock 时 `signature = "mock-upload"`, `psign = "mock-play"`, `fetchMediaInfo` → READY / 600 秒。真实实现按 spec §3（上传签名 HMAC-SHA1；播放签名 HS256 JWT，`jose` 或 node `crypto`）。
- `src/services/courses.ts`：`courseAccess(course, grants, role)`、`listCatalog(userId, role)`、`getCourseDetail(userId, role, courseId)`、`getPlayInfo(userId, role, courseId, lessonId)`、`saveProgress(userId, role, courseId, lessonId, body)`、`listMyCourses(userId, role)`；导出 `assertCourseAccess` 供 Task 2。
- 契约 `src/contract/course.ts`：`CourseAccessSchema = z.enum(["GRANTED","PREVIEW","LOCKED"])`、`VideoStatusSchema`、`CourseCardSchema`、`CourseLessonSchema`（学生视角）、`CourseDetailSchema`、`CourseCatalogSchema`、`PlayInfoSchema`、`LessonProgressBodySchema`、`MyCoursesSchema`，形状按 spec §4.1。

- [ ] **Step 1: schema + 迁移**（spec §2；`legacyVideoUrl` 保留旧 `videoUrl`；`durationMinutes*60`；约束名对齐 `20260914130000_admin_content/migration.sql`）；`prisma migrate deploy` 到开发库与测试库；`pnpm db:seed` 两次幂等。
- [ ] **Step 2: `vod.ts` + 测试**（固定 secret / 时间戳的签名快照；mock 分支；`verifyCallbackToken` 常量时间比较）。
- [ ] **Step 3: 契约 + `AppError` 409 / `CONFLICT`**。
- [ ] **Step 4: services + routes**（`/api/courses/*`、`/api/me/courses` 挂在 `meRoutes`；`/api/vod/callback` 在 `requestUser` 之前注册，`POST` 校验 `?token=`，解析 `EventType === "ProcedureStateChanged"` 的 `ProcedureStateChangeEvent`：`FileId`、`Status`、`MetaData.Duration`、`MediaProcessResultSet` 里的封面）。
- [ ] **Step 5: 测试**（spec §7 后端第 2、4 项，全部用 `VOD_MOCK=1`；`src/test/setup.ts` 里默认 `process.env.VOD_MOCK ??= "1"`）。
- [ ] **Step 6:** `/api/content` 去掉 `courses`；admin 现有课程列表 / `contentTitles` 适配新字段以编译通过（Task 2 再重做）；README「网课 / VOD」一节（spec §8 + 环境变量）；`pnpm openapi`、根 `pnpm gen:api`、四件套全绿；提交 `feat(api): 网课数据模型、VOD 签名 / 回调、学生端课程接口`。

---

### Task 2（后端）: 管理端课程 / 章 / 课时 / 上传 / 授权接口

**Files:**
- Modify: `apps/api/src/contract/admin.ts`（课程相关重写；`AdminContentBodySchema` 退化为 `AdminMaterialBodySchema`，`POST /content` 只收资料；`DELETE /content/{type}/{id}` 的 `type` 只剩 `MATERIAL`）, `apps/api/src/routes/admin/{content,index,summary,students}.ts`, `apps/api/src/routes/admin.test.ts`, `apps/api/README.md`
- Create: `apps/api/src/routes/admin/courses.ts`, `apps/api/src/services/admin-courses.ts`

- [ ] **Step 1: 契约**（spec §4.2：`AdminCourseSchema`、`AdminCourseDetailSchema`、`AdminCourseBodySchema`、`AdminCoursePatchSchema`、`AdminChapterBodySchema`、`AdminLessonBodySchema`、`AdminLessonPatchSchema`、`AdminLessonOrderBodySchema`、`AdminCourseStudentSchema`、`AdminCourseGrantBodySchema`、`UploadSignatureSchema`）。
- [ ] **Step 2: 路由**（`operationId`：`listAdminCourses / getAdminCourse / createAdminCourse / updateAdminCourse / deleteAdminCourse / createAdminChapter / updateAdminChapter / deleteAdminChapter / createAdminLesson / updateAdminLesson / deleteAdminLesson / reorderAdminLessons / refreshAdminLessonVideo / createVodUploadSignature / listAdminCourseStudents / grantAdminCourse / revokeAdminCourseGrant`）；删除课程事务里清 `AccessGrant{COURSE}`；`grantAdminCourse` 用 `createMany skipDuplicates` + 已有的更新 `expiresAt`；`refresh` 调 `fetchMediaInfo` 回填。
- [ ] **Step 3: 测试**（spec §7：课程 CRUD、章 / 课时 / 排序、上传签名 mock、批量授权幂等、学员列表进度、删除级联清 grant；旧 `POST /content` COURSE 用例改为新接口）。
- [ ] **Step 4:** `summary` 三个计数；README 端点清单；`pnpm openapi`、根 `pnpm gen:api`、四件套；提交 `feat(api): 管理端课程结构 / 视频上传签名 / 按课授权接口`。

---

### Task 3（学生端）: 目录、课程页、播放页、我的课程

**Files:**
- Create: `apps/web/src/routes/{courses.tsx, courses_.$courseId.tsx, courses_.$courseId.$lessonId.tsx, me.courses.tsx}`, `apps/web/src/views/courses/{CourseCatalogPage,CoursePage,PlayerPage,MyCoursesPage,EnrollDialog}.tsx`, `apps/web/src/features/video-player/{VideoPlayer.tsx, use-play-info.ts, progress.ts, progress.test.ts}`, `apps/web/src/entities/course/index.ts`, `apps/web/src/shared/lib/format-duration.ts`（+ test）, `apps/web/src/shared/vendor/tcplayer.d.ts`
- Modify: `apps/web/index.html`（tcplayer CDN）, `apps/web/src/widgets/navbar/Navbar.tsx`（「网课」）, `apps/web/src/api/{queries,mutations}.ts`, `apps/web/.gitignore`（`public/sample.mp4`）, `apps/web/README.md`

- [ ] **Step 1: 数据层**：`coursesQuery()`、`courseQuery(id)`、`playInfoQuery(courseId, lessonId)`（`staleTime` 到 `expiresAt` 前 5 分钟）、`myCoursesQuery()`；`useSaveProgress()`（`{ courseId, lessonId, body }`，节流由调用方做；成功后不失效任何 query，离开播放页时失效 `course` / `my-courses`）。
- [ ] **Step 2: 纯函数 + 测试**：`progress.ts`：`shouldMarkCompleted(position, duration)`（≥ 90% 或 duration 为 null 时 `ended` 才算）、`nextPlayableLesson(detail, currentId)`、`flattenLessons(detail)`；`format-duration.ts`：`formatDuration(seconds)` → `1 小时 20 分` / `35 分钟` / `< 1 分钟`。
- [ ] **Step 3: 页面**（spec §5）：`VideoPlayer` props `{ playInfo, startAt, onProgress(position), onEnded, onExpired }`；`window.TCPlayer` 不存在或 `psign === "mock-play"` 时渲染 `<video controls src="/sample.mp4">`（注释：验收用，`public/sample.mp4` 不入库）；进度上报：`timeupdate` 距上次 ≥ 10 秒、`pause`、`visibilitychange hidden`、卸载时用 `navigator.sendBeacon`（fetch keepalive 也可）；`ended` → `completed` 并跳下一可播课时。`EnrollDialog` 用 `DialogShell`，文案见 spec §5。
- [ ] **Step 4:** 四件套；浏览器（后端 3012 `VOD_MOCK=1`，seed 的示例课）：目录 → 课程页 → 播放 mock 视频 → 进度 / 完成 → 我的课程；游客试看与锁定态。提交 `feat(web): 网课目录 / 课程页 / 播放与学习进度`。

---

### Task 4（管理端）: 课程详情页（结构、上传、学员）

**Files:**
- Modify: `apps/admin/src/routes/_admin/courses.tsx`, `apps/admin/src/views/courses/*`（重做：`CoursesPage` 列表；`course-schema.ts` 去掉 lessons）, `apps/admin/src/views/students/GrantsDialog.tsx`（COURSE 数据源改 `adminCoursesQuery`）, `apps/admin/src/views/dashboard/DashboardPage.tsx`, `apps/admin/src/api/{queries,mutations}.ts`, `apps/admin/package.json`（`vod-js-sdk-v6`）
- Create: `apps/admin/src/routes/_admin/courses_.$courseId.tsx`, `apps/admin/src/views/course-detail/{CourseDetailPage,CourseInfoForm,StructureEditor,ChapterDialog,LessonDialog,UploadButton,StudentsTab,GrantDialog}.tsx`, `apps/admin/src/views/course-detail/{lesson-schema,chapter-schema,upload-state,upload-state.test,structure}.ts`（`structure.ts`：`moveLesson / moveChapter / toOrderBody` 纯函数 + 测试）

- [ ] **Step 1: 数据层**（queries：`adminCoursesQuery(search)`、`adminCourseQuery(id)`、`adminCourseStudentsQuery(id, page)`；mutations 按 spec §4.2 全部端点，失效 `["admin","courses"]` / `["admin","course",id]` / `["admin","summary"]`）。
- [ ] **Step 2: 纯函数 + 测试**（`upload-state.ts` 状态机；`structure.ts`）。
- [ ] **Step 3: 页面**（spec §6）：`UploadButton` 流程：`createVodUploadSignature` → `new TcVod({ getSignature })` → `uploader.on("media_progress")` → `done` 拿 `fileId` → `updateAdminLesson({ videoFileId })`；mock 环境（签名为 `mock-upload`）时跳过真实上传、直接写 `videoFileId = "mock-" + Date.now()`（注释说明）。
- [ ] **Step 4:** 四件套；浏览器（后端 3012 mock）：新建课程 → 章 / 课时 → 上传（mock）→ 试看 → 上架 → 开通学员 → 学生端可见。提交 `feat(admin): 课程详情页 —— 章节课时编辑、VOD 上传、按课开通`。

---

## 自检记录

- 覆盖：spec §2–§4.1 → T1；§4.2–4.3 → T2；§5 → T3；§6 → T4；§7 分布各任务；§8 → T1 README。
- 接口一致：`vod.ts` 导出（T1）被 T2 用；契约 `CourseCard / CourseDetail / PlayInfo`（T1）与 T3 页面字段一致；`AdminCourseDetail` / 排序 body（T2）与 T4 `structure.ts` 一致；`videoStatus` 枚举五态三端一致。
- 无占位：端点、字段、文案、mock 约定、环境变量均写明。
