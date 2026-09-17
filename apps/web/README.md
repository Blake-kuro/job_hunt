# 职寻 · 校园招聘岗位看板（前端）

React 19 + Vite + TanStack Router / Query + Tailwind v4。后端位于 `../api`；依赖统一在仓库根目录安装。

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
pnpm gen:api    # 默认读取 ../api/openapi.json，也支持 OPENAPI_SOURCE
```

游客无需登录即可浏览前 20 条岗位 / 20 道题；登录与 PRO 的权益见 /pro。

## 网课

路由（`src/routes`，TanStack Router 文件路由）：

- `/courses` 课程目录（卡片带 `access` 与进度）
- `/courses/$courseId` 课程页：章 / 课时、试看 / 锁定、「继续学习」
- `/courses/$courseId/$lessonId` 播放页：锁定 → 开通引导；处理中 → 提示；可播 → 播放器
- `/me/courses` 我的课程（有授权或有进度的课程，按最近学习排序）

播放器（`src/features/video-player/`）：

- `VideoPlayer.tsx`：后端返回 mock 签名（`VOD_MOCK=1` 时 `psign === "mock-play"`）→ 原生 `<video>` 播 `public/sample.mp4`（本地放一个小 mp4 即可，已在 .gitignore）；否则按需加载腾讯云 TCPlayer v5，加载中显示占位，加载失败（离线 / CDN 被拦）显示「播放器加载失败，请检查网络后重试」并提供重试，**不再退回示例视频**。
- `load-tcplayer.ts`：播放页第一次需要时向 `<head>` 注入 TCPlayer 的 CSS + JS（`index.html` 不再全局引入，避免阻塞其他页面首屏）；缓存 Promise，并发共用一次注入，失败 resolve `null`。注入逻辑是可注入依赖，`load-tcplayer.test.ts` 无需 DOM。
- `VITE_TCPLAYER_LICENSE_URL`（`.env.example`）：TCPlayer v5 必需的 Web 播放 License URL，在腾讯云控制台「云点播 → 播放器 SDK → License 管理」申请并绑定本站域名；缺失时 `console.warn` 并仍尝试初始化（播放器会报 License 错误不出画面）。本地走 mock 不需要。
- `tcplayer.d.ts`：`window.TCPlayer` 的最小类型声明（`fileID / appID / psign / licenseUrl / autoplay / language`）。
- 进度上报：`timeupdate` 每 ≥ 10 秒、`pause` / 页面隐藏立即、关闭标签 / 离开页面用 keepalive fetch；≥ 90% 或播完标记 `completed` 并自动跳下一可播课时。签名过期触发播放器 `error` → 重取签名并以当前位置重建播放器（自动最多 2 次，之后手动重试）。

## 命令

`pnpm typecheck` / `pnpm lint` / `pnpm test` / `pnpm build`
