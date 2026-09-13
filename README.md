# job_hunt_back

职寻 · 校园招聘岗位与刷题的后端 API。Hono 4 + Prisma 7 + PostgreSQL，Node 22，pnpm。

## 快速开始

```bash
pnpm install
pnpm db:up          # 启动本地 Postgres（docker compose，端口 5433）
cp .env.example .env
pnpm db:migrate      # 建表
pnpm db:seed         # 写入开发账号等种子数据
pnpm db:import       # 可选：导入岗位数据（Excel）
pnpm dev             # http://localhost:3001
```

## 环境变量（`.env`，参考 `.env.example`）

| 变量 | 说明 |
| --- | --- |
| `DATABASE_URL` | 开发库连接串 |
| `TEST_DATABASE_URL` | 独立集成测试库，库名必须以 `_test` 结尾；不设置则跳过集成测试 |
| `PORT` | HTTP 端口，默认 `3001` |
| `CORS_ORIGINS` | 允许跨域访问的前端源，逗号分隔；前端走 Vite 代理时不需要 |

## 接口与文档

所有接口挂在 `/api` 前缀下，统一 JSON 错误结构 `{ error: { code, message, issues? } }`（`code` 为 `VALIDATION` / `NOT_FOUND` / `INTERNAL`）。

- Swagger UI：`GET /api/docs`
- OpenAPI 3.1 文档：`GET /api/openapi.json`（同时以 `openapi.json` 文件形式提交在仓库根目录）

主要资源：

- `GET /api/me` —— 当前用户
- `GET /api/jobs`、`GET /api/jobs/progress`、`PUT|DELETE /api/jobs/{id}/favorite`、`PUT|DELETE /api/jobs/{id}/application` —— 岗位列表、收藏、投递状态
- `GET /api/quiz/today`、`POST /api/quiz/attempts`、`GET /api/quiz/dashboard`、`GET /api/quiz/wrong-book`、`PUT /api/quiz/wrong-book/{questionId}`、`GET /api/quiz/company-sets` —— 每日一题、打卡仪表盘、错题本、公司题集

路由用 `@hono/zod-openapi` 的 `createRoute` + `OpenAPIHono` 定义，请求/响应 schema 来自 `src/contract/`（zod schema，均已 `.openapi(...)` 注册为组件）。

## 脚本

| 命令 | 说明 |
| --- | --- |
| `pnpm dev` | 本地开发（`tsx watch`） |
| `pnpm start` | 生产模式启动 |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` / `pnpm format` | Biome 检查 / 格式化 |
| `pnpm test` | 跑 vitest；`pretest` 会先执行 `openapi:check` |
| `pnpm openapi` | 重新生成 `openapi.json` |
| `pnpm openapi:check` | 生成后用 `git diff --exit-code` 校验 `openapi.json` 是否已提交且与代码一致（CI/pretest 门禁） |
| `pnpm db:up` | 启动本地 Postgres（docker compose，5433） |
| `pnpm db:migrate` | Prisma migrate |
| `pnpm db:seed` | 写入种子数据（开发账号等） |
| `pnpm db:import` | 从 Excel 导入岗位数据 |

## 修改路由后

改了 `src/routes/*.ts` 或 `src/contract/*.ts` 里的 schema 后，记得跑一次：

```bash
pnpm openapi
```

重新生成 `openapi.json` 并提交，否则 `pretest`（因而 `pnpm test`）会因为 `openapi:check` 检测到文件与代码不一致而失败。

## 测试

```bash
pnpm test
```

集成测试使用真实数据库（`TEST_DATABASE_URL`，库名以 `_test` 结尾），不设置该变量时相关用例会被跳过（`describe.skipIf(!hasDb)`）。

## 项目结构

```
src/
  app.ts          # OpenAPIHono 组装：CORS、日志、/api 子应用、Swagger UI、错误处理
  routes/         # 每个资源一个 OpenAPIHono 子应用（createRoute 定义 + handler）
  services/       # 业务逻辑，访问 Prisma
  contract/       # zod schema（请求/响应/参数），同时是 OpenAPI 组件的来源
  lib/            # 错误类型、校验 hook、工具函数
scripts/
  openapi.ts      # 生成 openapi.json
  import-jobs.ts  # 导入岗位 Excel
prisma/
  schema.prisma
```
