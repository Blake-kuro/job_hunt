# job_hunt_back

职寻 · 校园招聘岗位与刷题的后端 API。Hono 4 + Prisma 7 + PostgreSQL，Node 22，pnpm。

## 启动

```bash
nvm use && corepack enable pnpm && pnpm install
cp .env.example .env          # DATABASE_URL / TEST_DATABASE_URL / PORT / CORS_ORIGINS
pnpm db:up && pnpm db:migrate && pnpm db:seed
pnpm db:import /absolute/path/岗位.xlsx
pnpm dev                      # http://localhost:3001
```

- 接口文档：http://localhost:3001/api/docs （Swagger UI）
- OpenAPI 3.1：http://localhost:3001/api/openapi.json ，同一份提交在仓库根 `openapi.json`

## 契约

`openapi.json` 是对外契约。改了路由或 `src/contract` 后运行 `pnpm openapi` 重新生成并一起提交；`pnpm test` 会先校验生成结果与提交文件一致（`openapi:check`）。

前端 / 其他项目消费方式：`openapi-typescript openapi.json -o schema.d.ts`，或任何 OpenAPI 客户端生成器。

## 约定

- 手机号验证码免密登录；验证成功后自动注册，使用 HttpOnly Cookie 保存 30 天会话。
- 开发环境会在后端日志和发送接口的 `developmentCode` 字段显示验证码；生产环境接入短信服务商前会拒绝发送。
- 登录身份独立保存，已预留 `WECHAT` / `QQ` 类型，后续可将扫码身份绑定到同一用户。
- 错误统一 `{ error: { code, message, issues? } }`，包括参数、登录态、验证码及频控错误。
- 跨域：`CORS_ORIGINS` 逗号分隔；前端走 Vite 代理时不需要。
- 时区 Asia/Shanghai：日期边界只经 `src/lib/dates.ts`。
- 三档访问：游客（device Cookie 匿名建档）看岗位前 20 条 / 题库前 20 道；手机号登录后 100 条 / 200 道；PRO 无限制。手动开通：`pnpm set-plan <手机号> PRO [天数]`（不填天数为永久；`FREE` 取消）。

## 测试

集成测试打真库且会清空业务表，只接受以 `_test` 结尾的 `TEST_DATABASE_URL`：

```bash
docker compose exec db createdb -U postgres job_hunt_test
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/job_hunt_test pnpm exec prisma migrate deploy
pnpm test
```

## Excel 导入

多工作表；表名含"秋招/实习"→分类 1，"央国企/国企"→2，"外企"→3。有 `id` 列按 id upsert（之后按提示执行 `setval`），否则按 `serialNumber`，再否则插入。
