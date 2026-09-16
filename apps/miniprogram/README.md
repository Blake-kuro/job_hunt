# 职寻刷题小程序

原生微信小程序（TypeScript），复用 `../api` 后端，界面沿用学生端的 Industry 设计系统（冷灰底、钢蓝强调、直角）。当前使用 `touristappid`，用微信开发者工具导入本目录体验。

## 页面

- 题库（tab）：打卡仪表盘、按公司分组的分类列表（已答 / 共 / 答对、进度条、开始 / 继续 / 已完成）、累计配额与登录 / 退出。
- 刷题：`pages/quiz/quiz?categoryId=…`，按分类顺序取题；单选 / 多选 / 判断作答，揭晓答案与解析，下一题；配额用尽或答完时给出对应提示。
- 错题本（tab）：按到期日排队，可标记已掌握。
- 登录：手机号验证码（开发环境验证码自动填入）。

## 运行

1. 后端运行在 `http://localhost:3001`（`miniprogram/config.ts` 的 `API_BASE_URL`；真机联调改成电脑的局域网 IP）。
2. 微信开发者工具导入本目录，选测试号；开发阶段勾选「不校验合法域名」。
3. 上线前把 `API_BASE_URL` 换成 HTTPS 域名并在微信后台配置 request 合法域名；用正式 AppID 替换 `project.config.json` 的 `appid`。

## 约定

- 接口类型 `miniprogram/api/schema.d.ts` 由根目录 `pnpm gen:api`（或本目录 `pnpm gen:api`）生成，不要手改。
- 登录态靠 cookie：`utils/request.ts` 维护一个 cookie 罐（`job_hunt_device` 游客 + `job_hunt_session` 会话），存在本地 storage；退出登录会调 `/api/auth/logout` 并清空。
- 配额与网页版一致：游客累计 20 道、免费账号 200 道、PRO 不限，不按天重置。
- `pnpm typecheck && pnpm test`：`tests/*.test.cjs` 用 node 的 vm 跑页面逻辑（不含 WXML），不能替代开发者工具与真机验收。
