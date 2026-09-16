# job_hunt

职寻 monorepo：学生端、后端、管理后台与微信刷题小程序。统一使用 Node 22 和 pnpm 12.4.1。

| 目录 | 项目 | 本地端口 |
| --- | --- | --- |
| `apps/web` | React 学生端 | 5173 |
| `apps/api` | Hono / Prisma / PostgreSQL 后端 | 3001 |
| `apps/admin` | React 管理后台 | 5174 |
| `apps/miniprogram` | 微信原生小程序 | 微信开发者工具 |

## 开发

```bash
source ~/.nvm/nvm.sh && nvm use
pnpm install --frozen-lockfile
# 首次配置；已有本地配置时不要覆盖
cp apps/api/.env.example apps/api/.env
pnpm db:up
pnpm db:migrate
pnpm db:seed
pnpm dev
```

可分别使用 `pnpm dev:web`、`pnpm dev:api`、`pnpm dev:admin`。前端代理配置放在各自目录的 `.env.local`，`VITE_API_PROXY` 默认指向 `http://localhost:3001`。管理员手机号在后端 `.env` 的 `ADMIN_PHONE_NUMBERS` 配置。

微信开发者工具导入 `apps/miniprogram`（不是仓库根目录）。目前使用测试 AppID，正式发布前需要替换 AppID、配置 HTTPS 合法域名；开发工具编译和真机验收独立于 Web 构建。

## 验证与接口类型

**当前保留的已知差异：** 导入的后端 `feat/company-banks` 已切换公司/分类刷题接口及数组答案，学生端、管理端和小程序仍保留导入时的实现。各应用独立检查通过不代表公司题库已完成跨端联调。本次迁移不自动完成该功能；运行 `pnpm gen:api` 会暴露前端尚待适配的类型错误，应与接口适配一并进行。

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm gen:api
```

`typecheck` 覆盖四个应用；`lint`、`test` 覆盖提供对应脚本的 Web、API、Admin；`build` 构建两个 Web 应用。API 使用 tsx 运行，小程序使用微信开发者工具编译。

API 集成测试要求后端 `.env` 设置独立的 `TEST_DATABASE_URL`，数据库名必须以 `_test` 结尾，未配置时数据库测试会跳过。先对测试库执行迁移；不要使用开发或生产数据库。

根目录 `pnpm gen:api` 先生成 `apps/api/openapi.json`，再更新学生端和管理端的 `src/api/schema.d.ts`。类型文件不得手改。单端可运行 `pnpm --filter job-hunt-front gen:api` 或 `pnpm --filter job-hunt-admin gen:api`；支持 `OPENAPI_SOURCE` 覆盖输入。

其他命令通过 `pnpm --filter <包名> <命令>` 执行，如 `pnpm --filter job-hunt-back db:import /absolute/path/岗位.xlsx`。仅维护根目录 workspace 与锁文件。

## 迁移说明

四个原仓库的完整历史通过非 squash subtree 合并。导入基线：学生端 `f2a7d98`、后端 `891674d`、管理端 `d4a4efc`、小程序 `4e337eb`，包含现有公司题库分支成果。原后端、管理端、小程序仓库保留作迁移备份，后续开发统一在本仓库进行。

Compose 项目名固定为原来的 `job_hunt_back`，继续复用 `job_hunt_back_pgdata` 数据卷。原本地环境配置已迁入各应用目录，仍被 Git 忽略。`docs/` 中早期设计文档保留历史背景，涉及旧多仓库路径时以本文为准。
