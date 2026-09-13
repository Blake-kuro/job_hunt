# 职寻 · 校园招聘岗位看板

面向在校生的岗位索引与刷题打卡，采用 pnpm monorepo。

| 包 | 职责 | 开发端口 |
| --- | --- | --- |
| `apps/api` | Hono REST API、Prisma 7、PostgreSQL | 3001 |
| `apps/web` | React 19、Vite、TanStack Router / Query、Tailwind v4 | 5173 |
| `packages/shared` | zod 校验规则与 DTO 类型 | — |

## 首次启动

需要 Node 22、pnpm 和 Docker。

```bash
nvm use
corepack enable pnpm
cp .env.example .env     # 已有 .env 时不要覆盖
pnpm install            # 自动生成 Prisma Client
pnpm db:up              # Docker Postgres，宿主端口 5433
pnpm db:migrate
pnpm db:seed             # 开发账号、5 个分类、4 个题集、20 道题；可重复运行
pnpm dev                # 同时启动 API 和前端
```

打开 [http://localhost:5173](http://localhost:5173)。Vite 将 `/api` 代理至 3001。当前使用 `dev@local` 开发账号，没有登录功能。

岗位筛选、搜索、排序和页码保存在 URL。收藏与投递使用乐观更新，失败时恢复原值并提示错误。刷题答案由服务端判定，提交后显示解析，点击“下一题”才切换；答错自动加入错题本，侧栏可以标记掌握。题库分类和公司题集目前展示数量，不提供单独筛选练习入口。

## 验证与测试数据库

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

集成测试会清空测试库的业务表，因此**只接受 `TEST_DATABASE_URL`，数据库名必须以 `_test` 结尾**，不会回退到 `DATABASE_URL`。未配置时跳过数据库测试，纯函数和前端测试仍会运行。首次准备独立测试库：

```bash
docker compose exec db createdb -U postgres job_hunt_test
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/job_hunt_test pnpm --filter @job-hunt/api exec prisma migrate deploy
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5433/job_hunt_test pnpm test
```

也可以将 `TEST_DATABASE_URL` 保存到根 `.env`（示例见 `.env.example`）。测试库已存在时跳过 `createdb`。

## Excel 导入

```bash
pnpm db:import -- /absolute/path/岗位.xlsx
```

支持多工作表；表名含“秋招”或“实习”对应分类 1，“央国企”或“国企”对应 2，“外企”对应 3。按 `id` 优先、其次 `serialNumber` 更新已有记录，没有这两列时每次新增。按 id 导入后，按脚本提示同步自增序列。不要用无标识列的表格验证重复导入幂等性。

## 目录与接口

前端按 `entities / features / widgets / views / shared` 组织，入口在 `apps/web/src/main.tsx`，文件路由在 `apps/web/src/routes`。`routeTree.gen.ts` 由 Vite 的路由插件生成并纳入版本管理。

API 在 `/api` 下，包括 `/me`、`/jobs`、`/jobs/progress`，以及 `/quiz/today`、`/quiz/attempts`、`/quiz/dashboard`、`/quiz/wrong-book`、`/quiz/company-sets`。错误统一为 `{ error: { code, message, issues? } }`。前端使用 Hono RPC 推导端点类型，只从 API 包导入类型。

日期边界统一按 Asia/Shanghai 计算。题目选择当前用户尚未答过的第一题，全部答完后显示空状态；看板统计本周与累计答过的不同题目数，正确率按该题全部作答记录计算。

`pnpm --filter @job-hunt/api start` 通过 tsx 运行 API；`pnpm build` 检查 shared / API 类型并构建前端到 `apps/web/dist`。部署需要将 `/api` 转发到 API 服务，其余页面回退到 `index.html`。开发代理不属于静态构建产物。
