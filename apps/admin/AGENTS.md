# 项目约定（管理端）

React 19 + Vite 8 + TanStack Router / Query + Tailwind v4，TypeScript 7，pnpm，Node 22。后端在 `../api`，学生端在 `../web`。

- 命令前 `source ~/.nvm/nvm.sh && nvm use`；用 pnpm。
- 接口类型与 client 来自 workspace 包 `@job-hunt/api-client`（`packages/api-client/src/schema.d.ts` 由后端 `openapi.json` 生成）。后端接口变了：根目录 `pnpm gen:api`，然后一起提交。不要手改 `schema.d.ts`。
- 调用后端只经 `@job-hunt/api-client/client` 的 `client` + `unwrap`（写在 `src/api/queries.ts` / `mutations.ts`）；DTO 类型从 `@job-hunt/api-client/types` 取。
- UI 组件、`cn`、防抖 hook 与设计令牌来自 `@job-hunt/ui`（`@job-hunt/ui/components/button`、`@job-hunt/ui/lib/utils`、`@job-hunt/ui/hooks/use-debounced-search`）；`src/styles/globals.css` 只引包样式并定义字体变量。不要在 admin 里再拷一份通用组件（业务组件如 `widgets/auth-error/AuthErrorPanel` 除外）。
- 列表页用 `DataTable`，列定义 `Column<T>[]` 放页面文件顶部；表单对话框用 `FormDialog` + `useForm({ resolver: zodResolver(schema) })`，每个表单一个 `*-schema.ts`（`schema` / `FormValues` / `defaultValues` / `fromEntity` / `toBody`），校验文案写在 schema 里并有 vitest 用例。
- 路由 `errorComponent` 用 `src/routes/-error.tsx` 的 `RouterErrorPanel`（登录 / 受保护布局用 `AuthErrorPanel`）。
- 本地开发 `.env.local` 里 `VITE_API_PROXY` 指向后端；不需要 CORS。
- 所有页面在 `_admin` 布局下，非管理员会被 `beforeLoad` 踢回 `/login`。
- 提交前 `pnpm typecheck && pnpm lint && pnpm test`。
- 不要启动或停止 3000 端口上的东西；验证用 5174，只停自己起的进程。
