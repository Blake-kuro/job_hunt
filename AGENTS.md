# job_hunt monorepo

- Node 22、pnpm 12；命令前 `source ~/.nvm/nvm.sh && nvm use`。
- `apps/web` 学生端、`apps/api` 后端、`apps/admin` 管理端、`apps/miniprogram` 微信小程序。
- 在根目录安装依赖，只维护根 `pnpm-lock.yaml`；子项目约定见各自 AGENTS.md。
- 后端接口变更后在根目录 `pnpm gen:api`，提交 OpenAPI 和两端生成类型，不手改 schema.d.ts。
- 提交前运行 `pnpm typecheck && pnpm lint && pnpm test && pnpm build`。
- 集成测试仅使用 TEST_DATABASE_URL 指定的 `_test` 数据库；不得使用开发/生产数据。
- 不启动或停止 3000 端口；学生端 5173、管理端 5174、后端 3001，只停自己启动的进程。
- 不提交 .env、project.private.config.json、生成的 Prisma 客户端或 node_modules。
