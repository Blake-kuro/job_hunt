# 职寻 · 管理后台

「职寻」校园招聘 + 刷题应用的运营控制台：管理学生档位与授权、岗位（含 Excel 导入）、题库、资料与网课。复用 `../api` 的 `/api/admin/*` 接口，仅 `ADMIN_PHONE_NUMBERS` 中的手机号可登录。

技术栈：React 19 + Vite 8 + TanStack Router / Query + Tailwind v4，TypeScript 7，pnpm，Node 22。

## 启动

```bash
source ~/.nvm/nvm.sh && nvm use 22
pnpm install
cp .env.example .env.local   # VITE_API_PROXY 指向后端（默认 http://localhost:3001）
pnpm dev                     # http://localhost:5174
```

后端 `.env` 需配置 `ADMIN_PHONE_NUMBERS`（逗号分隔）；开发环境验证码会随发送响应返回并自动填入。

## 接口类型

`src/api/schema.d.ts` 由后端 `openapi.json` 生成，不要手改：

```bash
pnpm gen:api # 默认读取 ../api/openapi.json；依赖统一在仓库根目录安装
```

## 网课：课程详情页

`/courses` 课程列表（新建 / 编辑基本信息、发布、删除）；点进 `/courses/$courseId` 是课程详情页（`src/views/course-detail/`），顶部是基本信息表单（`CourseInfoForm`，结构刷新不会清掉未保存的表单），下面两个 Tab：

- **结构**（`StructureEditor`）：章 → 课时树，「未分章」组在最前。新建 / 编辑章与课时（`ChapterDialog` / `LessonDialog`，`FormDialog` + zod schema），章 / 课时上移下移由 `structure.ts` 的纯函数算出新顺序后整棵树提交 `PUT /admin/courses/{id}/lessons/order`（后端要求章 / 课时全覆盖）。删章时课时回到「未分章」；删课时会连带删学习进度，VOD 上的视频文件不删除（需在 VOD 控制台清理）。
- **上传**（`UploadButton` + `upload-state.ts` reducer）：每个课时一个「上传视频」按钮。流程：`POST /admin/vod/upload-signature` 取签名 → 签名为 `mock-upload`（后端 `VOD_MOCK=1`）时不真上传、直接生成 `mock-<时间戳>` 的 fileId；否则用 `vod-js-sdk-v6` 浏览器直传腾讯云并显示进度 → `PATCH /admin/lessons/{id}` 写 `videoFileId`（状态置「处理中」）→ 立即「刷新状态」一次。真实环境转码需要几分钟，回调到达前可手动点课时上的「刷新状态」（`DescribeMediaInfos`）。视频已传到 VOD 但保存课时失败时，fileId 保留在错误提示里，「重试保存」只重做保存不重传。**真实直传分支尚未用真实凭据在浏览器验证过**（见 `apps/api/README.md`「真实联调待确认清单」）。
- **学员**（`StudentsTab` + `GrantDialog`）：已开通学员列表（含进度百分比）与批量开通：粘贴多行手机号 → 逐个精确匹配学生 → `POST /admin/courses/{id}/grants`；不存在或已停用的手机号会单独列出、不会开通。免费课（`priceCents = 0`）无需开通。

## 约定

- 调用后端只经 `src/api/client.ts` 的 `client` + `unwrap`；DTO 类型从 `@api/types` 取；查询用 `@api/queries`，写操作用 `@api/mutations`。
- 所有页面在 `routes/_admin.tsx` 布局下，`beforeLoad` 会把非管理员踢回 `/login`。
- 提交前：`pnpm typecheck && pnpm lint && pnpm test && pnpm build`。

更多见 `AGENTS.md`。
