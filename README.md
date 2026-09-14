# 职寻管理后台

学生权限、资料、题库与网课管理。复用 `job_hunt_back` API。

```bash
nvm use 22
pnpm install
cp .env.example .env.local
pnpm dev # http://localhost:5174
```

后端 `.env` 必须配置 `ADMIN_PHONE_NUMBERS`，多个手机号用逗号分隔。管理员首次验证码登录会自动获得 ADMIN 角色。
