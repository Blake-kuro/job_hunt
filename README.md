# 职寻 · 校园招聘岗位看板（前端）

React 19 + Vite + TanStack Router / Query + Tailwind v4。后端：[job_hunt_back](https://github.com/Blake-kuro/job_hunt_back)。

## 启动

```bash
nvm use && corepack enable pnpm && pnpm install
cp .env.example .env.local     # VITE_API_PROXY 指向后端（默认本机 3001）
pnpm dev                       # http://localhost:5173
```

后端启动方式见其仓库 README（Docker Postgres、迁移、种子、Excel 导入都在那边）。

## 接口类型

`src/api/schema.d.ts` 由后端的 OpenAPI 文档生成并提交。后端接口变化后：

```bash
OPENAPI_SOURCE=http://localhost:3001/api/openapi.json pnpm gen:api    # 或 ../job_hunt_back/openapi.json
```

## 命令

`pnpm typecheck` / `pnpm lint` / `pnpm test` / `pnpm build`
