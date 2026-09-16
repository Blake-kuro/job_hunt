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

## 约定

- 调用后端只经 `src/api/client.ts` 的 `client` + `unwrap`；DTO 类型从 `@api/types` 取；查询用 `@api/queries`，写操作用 `@api/mutations`。
- 所有页面在 `routes/_admin.tsx` 布局下，`beforeLoad` 会把非管理员踢回 `/login`。
- 提交前：`pnpm typecheck && pnpm lint && pnpm test && pnpm build`。

更多见 `AGENTS.md`。
