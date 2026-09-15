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
- 管理后台见下文「后台管理」一节。
- 学习内容接口只返回已发布且仍在授权有效期内的资料和网课；刷题配额见下文「刷题 API 与配额」。
- 错误统一 `{ error: { code, message, issues? } }`，包括参数、登录态、验证码及频控错误。
- 跨域：`CORS_ORIGINS` 逗号分隔；前端走 Vite 代理时不需要。
- 时区 Asia/Shanghai：日期边界只经 `src/lib/dates.ts`。
- 三档访问：游客（device Cookie 匿名建档）看岗位前 20 条 / 累计可作答 20 道题；手机号登录后 100 条 / 200 道；PRO 无限制。手动开通：`pnpm set-plan <手机号> PRO [天数]`（不填天数为永久；`FREE` 取消）。

## 刷题 API 与配额

题库三层：**公司 → 分类 → 题目**（`Company` / `QuestionCategory` / `Question`）。题目有题型 `type`（`SINGLE` 单选 / `MULTI` 多选 / `JUDGE` 判断，判断题选项固定 A 正确 / B 错误）、可选的 `section`（所属部分标签）与分类内顺序 `sortOrder`；`options` 为 2–6 个 `{ letter, text }`，`answer` 是已排序的字母串（如 `"B"`、`"AC"`）。判题与形状校验都在 `src/lib/grade.ts`。种子数据把 20 道示例题放在「通用题库」公司下。

- `GET /api/quiz/banks` 公司 → 分类列表（只计已发布题），每个分类带 `total / answered / correct`，外加当前用户 `quota`
- `GET /api/quiz/categories/{categoryId}/next` 该分类按 `sortOrder, id` 第一道未作答题，`index` 为它在分类内的序号（1 起）；无题时 `question: null`，`exhausted` 为 `QUOTA`（配额用尽）或 `ALL`（已答完）；分类不存在 404
- `POST /api/quiz/attempts` body `{ questionId, picked: ["A", "C"] }`；多选按集合判等（顺序无关），单选 / 判断要求恰好选一个；返回 `{ correct, answer: [...], explanation, accuracyRate }`；配额用尽作答新题 → 403 `FORBIDDEN`
- `GET /api/quiz/dashboard` 打卡 / 本周 / 累计 / 错题 + `quota`
- `GET /api/quiz/wrong-book`、`PUT /api/quiz/wrong-book/{questionId}` 错题本

配额 `quota = { tier, limit, used }` **全站共通、按作答过的不同题数计**：`used` = 该用户 `Attempt` 里去重后的题数；`limit` 为档位上限（游客 20 / 登录 200 / PRO 与管理员 `null`）。重复作答已答过的题不占配额，也不会被 403。按题授权（`AccessGrant{ QUESTION }`）数据保留但不再影响配额。

## 后台管理

管理员由 `ADMIN_PHONE_NUMBERS`（逗号分隔手机号）在登录时提升为 `ADMIN`（只升不降）；`/api/admin/*` 要求 `ADMIN` 角色，其余用户 403。管理端仓库：`Blake-kuro/job_hunt_admin`。

- `GET /api/admin/summary` 概览计数（学生 / 启用 / PRO / 游客 / 岗位 / 题目 / 已发布题目 / 资料 / 课程）
- `GET /api/admin/students?q&plan&enabled&page&pageSize` 学生分页列表（有手机号的用户），含档位、统计与授权内容标题
- `PATCH /api/admin/students/{id}` 修改姓名 / 启用 / 套餐 / PRO 到期（管理员账号 403）
- `PUT /api/admin/students/{id}/access` 整体替换授权（内容不存在 400）
- `GET /api/admin/materials` 全部资料
- `GET /api/admin/courses` 全部课程（含课时）
- `POST /api/admin/content` 创建 / 更新资料或课程（带 `id` 为更新），返回 `201 { id }`
- `DELETE /api/admin/content/{type}/{id}` 删除资料或课程，并清理对应授权
- `GET /api/admin/quiz-meta` 公司 → 分类树（含题量 / 已发布题量）
- `GET /api/admin/questions?q&companyId&categoryId&type&section&published&page&pageSize` 题目分页列表（按 `sortOrder, id`），含公司名 / 分类名 / 题型 / 选项 / 答案
- `POST /api/admin/questions` 创建题目，返回 `201 { id }`（分类不存在或题型 / 选项 / 答案形状不合法 400）
- `PATCH /api/admin/questions/{id}` 修改题目（校验合并后的题型 / 选项 / 答案；题目不存在 404）
- `DELETE /api/admin/questions/{id}` 删除题目并清理对应授权
- `POST /api/admin/question-categories` body `{ companyId, name }` 创建分类（公司不存在 / 同公司下同名 400）
- `GET /api/admin/jobs?q&category&page&pageSize` 岗位分页列表（按创建时间倒序，含收藏 / 投递计数）
- `POST /api/admin/jobs` 创建岗位，返回 `201 { id }`
- `PATCH /api/admin/jobs/{id}` 修改岗位（只写提供的字段，`null` 清空；不存在 404）
- `DELETE /api/admin/jobs/{id}` 删除岗位（收藏 / 投递级联删除；不存在 404）
- `POST /api/admin/jobs/import` 上传 xlsx（`multipart/form-data` 的 `file` 字段，≤ 20 MB）导入岗位，返回各工作表新增 / 更新 / 跳过明细（无法解析或超限 400）

## 测试

集成测试打真库且会清空业务表，只接受以 `_test` 结尾的 `TEST_DATABASE_URL`：

```bash
docker compose exec db createdb -U postgres job_hunt_test
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/job_hunt_test pnpm exec prisma migrate deploy
pnpm test
```

## Excel 导入

多工作表；表名含"秋招/实习"→分类 1，"央国企/国企"→2，"外企"→3。有 `id` 列按 id upsert，否则按 `serialNumber`，再否则插入。按 id 写入过时会自动同步 `Job.id` 的自增序列，不再需要手动执行 `setval`。

导入逻辑在 `src/lib/import-jobs.ts`（`importWorkbook`），两种入口：

- 命令行：`pnpm db:import -- <文件.xlsx>`
- 后台：`POST /api/admin/jobs/import` 上传文件，管理端可直接操作
