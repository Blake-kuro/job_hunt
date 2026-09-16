# 职寻刷题小程序

原生微信小程序，复用 `../api` 后端。当前使用 `touristappid`，将本目录导入微信开发者工具体验。

1. 后端运行在 `http://localhost:3001`。
2. 微信开发者工具导入本目录，并选择测试号。
3. 开发阶段勾选“不校验合法域名”；真机/上线前在 `miniprogram/config.ts` 填 HTTPS 域名并配置微信 request 合法域名。
4. 获得正式 AppID 后替换 `project.config.json` 的 `appid`。

登录使用现有手机号验证码。管理员在 `../admin` 管理端给该学生授予题目后即可刷题。
