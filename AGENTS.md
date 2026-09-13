# 项目约定

pnpm monorepo：`apps/api`（Hono + Prisma 7，Node 22）、`apps/web`（React 19 + Vite + TanStack Router/Query + Tailwind v4）、`packages/shared`（zod schema + DTO 类型）。

- 命令前先 `source ~/.nvm/nvm.sh && nvm use`（`.nvmrc` = 22），使用 pnpm。
- 数据库使用 Docker 的 5433 端口，连接串在根 `.env`；不要操作本机 5432 上的数据库。
- 集成测试只读取 `TEST_DATABASE_URL`，数据库名必须以 `_test` 结尾。测试会清空该库，不得指向开发库。
- 后端路由必须链式定义（`new Hono<Env>().get(...).put(...)`），保留 RPC 类型推导。
- 前端只能 `import type` 来自 `@job-hunt/api`，共享运行时 schema 放在 `@job-hunt/shared`。
- 日期边界只经 `apps/api/src/lib/dates.ts`（Asia/Shanghai）。
- 完成修改后运行 `pnpm typecheck && pnpm lint && pnpm test && pnpm build`。
- 先阅读已安装库的文档和类型定义；TS 7 / Hono / TanStack / Prisma 7 与旧版本有差异。
- 不启动或停止用户已有的 3000 端口服务；验证使用 3001 / 5173，只停止自己启动的进程。
