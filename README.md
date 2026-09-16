# job_hunt

职寻 monorepo：学生端、后端、管理后台与微信刷题小程序。统一使用 Node 22 和 pnpm 12.4.1。

| 目录 | 项目 | 本地端口 |
| --- | --- | --- |
| `apps/web` | React 学生端 | 5173 |
| `apps/api` | Hono / Prisma / PostgreSQL 后端 | 3001 |
| `apps/admin` | React 管理后台 | 5174 |
| `apps/miniprogram` | 微信原生小程序 | 微信开发者工具 |
| `packages/ui` | `@job-hunt/ui`：设计令牌 + shadcn/ui 组件 + hooks | — |
| `packages/api-client` | `@job-hunt/api-client`：OpenAPI 生成类型 + fetch 客户端 | — |

## packages/

两个 workspace 包都是源码包（`exports` 直指 `src/`，不构建），Vite / tsc 直接消费；只在根目录安装依赖。

- `@job-hunt/ui`：`styles/tokens.css`（Industry 令牌 + shadcn 变量映射）、`styles/globals.css`、shadcn 组件（`components/button`、`badge`、`input`、`textarea`、`label`、`checkbox`、`radio-group`、`select`、`dialog`、`form`、`table`、`separator`、`alert`）、自定义组件（`kicker`、`stat-card`、`pagination`、`progress-bar`、`data-table`、`form-dialog`、`error-panel`、`segmented`）与 hooks（`hooks/use-debounced-search`、`use-debounced-value`）。应用里 `import { Button } from "@job-hunt/ui/components/button"`，样式入口 `@import "@job-hunt/ui/styles/globals.css"`。新增 shadcn 组件在 `packages/ui` 下 `pnpm dlx shadcn@latest add <name>`，生成后把 `@/lib/utils` 改成相对路径并跑 `biome check --write`。
- `@job-hunt/api-client`：`client`（`client / unwrap / ApiError`）与 `types`（DTO 别名），`src/schema.d.ts` 由 `pnpm gen:api` 生成并提交。

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

公司题库统一使用「公司 → 分类 → 题目」结构。后台先创建公司及分类，再新增单选、多选或判断题；学生端及小程序选择分类刷题。作答请求和判题返回的答案为字母数组，后台编辑答案为排序后的字母串。累计配额不会每天重置。

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm gen:api
```

`typecheck` 和 `test` 覆盖四个应用与两个包；`lint` 覆盖 Web、API、Admin 与两个包；`build` 构建两个 Web 应用。API 使用 tsx 运行，小程序使用微信开发者工具编译；小程序页面逻辑另有 Node 回归测试，不替代开发者工具和真机验收。

API 集成测试要求后端 `.env` 设置独立的 `TEST_DATABASE_URL`，数据库名必须以 `_test` 结尾，未配置时数据库测试会跳过。先对测试库执行迁移；不要使用开发或生产数据库。

根目录 `pnpm gen:api` 先生成 `apps/api/openapi.json`，再更新 `packages/api-client/src/schema.d.ts` 和小程序的 `miniprogram/api/schema.d.ts`（学生端、管理端仍各自保留 `src/api/schema.d.ts` 与 `gen:api`，待迁移到 `@job-hunt/api-client` 后删除）。类型文件不得手改。单端可运行 `pnpm --filter <包名> gen:api`；支持 `OPENAPI_SOURCE` 覆盖输入。

其他命令通过 `pnpm --filter <包名> <命令>` 执行，如 `pnpm --filter job-hunt-back db:import /absolute/path/岗位.xlsx`。仅维护根目录 workspace 与锁文件。

## 迁移说明

四个原仓库的完整历史通过非 squash subtree 合并。导入基线：学生端 `f2a7d98`、后端 `891674d`、管理端 `d4a4efc`、小程序 `4e337eb`，包含现有公司题库分支成果。原后端、管理端、小程序仓库保留作迁移备份，后续开发统一在本仓库进行。

Compose 项目名固定为原来的 `job_hunt_back`，继续复用 `job_hunt_back_pgdata` 数据卷。原本地环境配置已迁入各应用目录，仍被 Git 忽略。`docs/` 中早期设计文档保留历史背景，涉及旧多仓库路径时以本文为准。
