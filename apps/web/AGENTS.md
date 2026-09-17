# 项目约定（前端）

React 19 + Vite 8 + TanStack Router / Query + Tailwind v4，TypeScript 7，pnpm，Node 22。后端在 `../api`。

- 命令前 `source ~/.nvm/nvm.sh && nvm use`；用 pnpm。
- 接口类型与 client 来自 workspace 包 `@job-hunt/api-client`（`packages/api-client/src/schema.d.ts` 由后端 `openapi.json` 生成）。后端接口变了：根目录 `pnpm gen:api`，然后一起提交。不要手改 `schema.d.ts`。
- 调用后端只经 `@job-hunt/api-client/client` 的 `client` + `unwrap`（写在 `src/api/queries.ts` / `mutations.ts`）；DTO 类型从 `@job-hunt/api-client/types` 取，业务侧经 `@entities/job|quiz` 门面 re-export。
- UI 组件、`cn`、防抖 hook 与设计令牌来自 `@job-hunt/ui`（`@job-hunt/ui/components/button`、`@job-hunt/ui/lib/utils`、`@job-hunt/ui/hooks/use-debounced-search`）；`src/styles/globals.css` 只引包样式并定义字体变量。不要在 web 里再拷一份组件。
- 路由 `errorComponent` 用 `src/routes/-error.tsx` 的 `RouterErrorPanel`；链接样式按钮写 `<Button asChild><Link …/></Button>`。
- 本地开发 `.env.local` 里 `VITE_API_PROXY` 指向后端；不需要 CORS。
- 提交前 `pnpm typecheck && pnpm lint && pnpm test`。
- 不要启动或停止 3000 端口上的东西；验证用 5173，只停自己起的进程。
