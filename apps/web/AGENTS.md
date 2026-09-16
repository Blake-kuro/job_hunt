# 项目约定（前端）

React 19 + Vite 8 + TanStack Router / Query + Tailwind v4，TypeScript 7，pnpm，Node 22。后端在 `../api`。

- 命令前 `source ~/.nvm/nvm.sh && nvm use`；用 pnpm。
- 接口类型来自 `src/api/schema.d.ts`（由后端 `openapi.json` 生成，提交在仓库里）。后端接口变了：`OPENAPI_SOURCE=<url 或 openapi.json 路径> pnpm gen:api`，然后一起提交。不要手改 `schema.d.ts`。
- 调用后端只经 `src/api/client.ts` 的 `client` + `unwrap`；DTO 类型从 `@api/types` 取。
- 本地开发 `.env.local` 里 `VITE_API_PROXY` 指向后端；不需要 CORS。
- 提交前 `pnpm typecheck && pnpm lint && pnpm test`。
- 不要启动或停止 3000 端口上的东西；验证用 5173，只停自己起的进程。
