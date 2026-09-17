# 可维护性重构（共享 UI 包 / API 客户端包 / 表单表格统一 / 后端去重）设计

日期：2026-09-17
状态：用户已确认（Tailwind v4 不动，组件层用 shadcn/ui；admin 表单改 react-hook-form + zod）
仓库：monorepo `/Users/black/Desktop/job_hunt`（main ee68418）

## 1. 目标

去掉三端之间与页面之间的复制粘贴，让"改一个按钮 / 一个表格样式 / 一个错误响应"只需改一处；不改任何业务行为，所有测试保持绿，三端观感不变（Industry 设计系统：冷灰底、钢蓝强调、直角）。

不做：改业务逻辑；改后端契约；小程序引 npm 组件库（原生小程序不支持，保持现状）；引入表格库（TanStack Table）——自建列定义驱动的 `DataTable` 够用。

## 2. 包结构

```
packages/ui            @job-hunt/ui         设计令牌 + shadcn 组件 + 自定义组件 + hooks（React 19 + Tailwind v4）
packages/api-client    @job-hunt/api-client 由 openapi.json 生成的 schema.d.ts + client/unwrap/ApiError + DTO 别名
apps/web               引用两者；删除 src/shared/ui、src/shared/lib/cn.ts、src/api/{client,types,schema.d}.ts
apps/admin             同上
apps/api               不引包；内部去重
apps/miniprogram       不变（api/schema.d.ts 仍单独生成）
```

`pnpm-workspace.yaml` 的 `packages` 加 `packages/*`。两个包都是**源码包**（不构建）：`package.json` 的 `exports` 直接指向 `./src/*.ts(x)`，Vite / tsc（`moduleResolution: bundler`）直接消费；`"type": "module"`，`private: true`。根 `tsconfig` 不需要 paths。

### 2.1 `@job-hunt/ui`

- 依赖：`radix-ui`（统一包）、`class-variance-authority`、`clsx`、`tailwind-merge`、`lucide-react`、`react-hook-form`、`@hookform/resolvers`、`zod`（peer：react、react-dom、@tanstack/react-router 仅 `LinkButton` / `ErrorPanel` 用，做成 peer 可选）。
- `src/styles/tokens.css`：从 `apps/web/src/styles/tokens.css` 搬来，**保留现有 `@theme` 令牌**（`--color-bg / surface / text / accent-* / neutral-* / divider / hairline`、`--font-heading / body`、阴影），这样现有的 `bg-accent`、`text-neutral-700`、`border-divider`、`font-heading` 工具类全部照旧可用。再追加 shadcn 需要的 CSS 变量映射（`--background: var(--color-bg)`、`--foreground: var(--color-text)`、`--primary: var(--color-accent)`、`--primary-foreground: var(--color-bg)`、`--secondary: var(--color-surface)`、`--muted: var(--color-neutral-200)`、`--muted-foreground: var(--color-neutral-700)`、`--border: var(--color-divider)`、`--input: var(--color-divider)`、`--ring: var(--color-accent)`、`--destructive: #b91c1c`、`--radius: 0`）并用 `@theme inline` 暴露成 `bg-background / text-primary …`。
- `src/styles/globals.css`：`@import "tailwindcss"; @import "./tokens.css"; @source "../";`（让包内组件的类名被扫描）+ 原 web `globals.css` 的 `@layer base`（body 字体、标题字体、`.blueprint` 角标等）。**应用侧 `globals.css` 只剩** `@import "@job-hunt/ui/styles/globals.css";` 与字体变量。
- `src/lib/utils.ts`：`cn()`（clsx + tailwind-merge，替换现有仅 clsx 的 `cn`）。
- shadcn 组件（`pnpm dlx shadcn@latest add`，风格 new-york，生成到 `src/components/`）：`button`（保留现有 `variant: primary | secondary | ghost`、`size: sm | md | lg` 的语义，用 cva 定义；`asChild` 支持 `<Link>`，取代 web 里两处手写的 link-as-button）、`badge`（替代 `Tag`，variants `neutral | accent | outline`）、`input`、`textarea`、`select`（Radix Select）、`label`、`checkbox`、`radio-group`、`dialog`、`form`（RHF 的 `Form / FormField / FormItem / FormLabel / FormControl / FormMessage`）、`table`、`separator`、`alert`。
- 自定义组件（`src/components/`）：`kicker.tsx`、`stat-card.tsx`、`pagination.tsx`（`{ page, pageSize, total, onChange }`）、`progress-bar.tsx`（`{ value: 0–100 }`，宽度用 `style` 是唯一允许的内联样式，加注释）、`data-table.tsx`（`{ columns: Column<T>[], rows, rowKey, caption, emptyMessage, renderCard? }`：宽屏 shadcn Table、窄屏可选卡片；`Column<T> = { id, header, width?, align?, headerSrOnly?, cell(row) }`；替代 web 的 `DataTable` 与 admin 的 5 张手写表）、`form-dialog.tsx`（`{ open, title, description?, onClose, form: UseFormReturn, onSubmit, submitLabel?, pending?, error?, wide?, children }`：Dialog + `<Form>` + footer（取消 / 提交，pending 禁用）+ 顶部 `role="alert"` 错误）、`error-panel.tsx`（`{ error, onRetry?, homeTo? }`，不依赖 router；应用侧包一层接 `ErrorComponentProps`）。
- hooks（`src/hooks/`）：`use-debounced-value.ts`（`useDebouncedValue(value, ms)`）与 `use-debounced-search.ts`（`useDebouncedSearch(initial, commit, ms=300)` → `[draft, setDraft]`，替换 admin 三处与 web `JobFilters` 的手写 setTimeout）。
- 导出：`package.json` `exports` 用通配 `"./components/*": "./src/components/*.tsx"`、`"./hooks/*"`、`"./lib/*"`、`"./styles/*": "./src/styles/*.css"`。应用里 `import { Button } from "@job-hunt/ui/components/button"`。
- Biome：包内加 `biome.json` 继承根规则；shadcn 生成的代码按 biome 格式化一次。

### 2.2 `@job-hunt/api-client`

- `src/schema.d.ts`：唯一一份生成物；脚本 `gen:api`: `pnpm dlx openapi-typescript@7 "${OPENAPI_SOURCE:-../../apps/api/openapi.json}" -o src/schema.d.ts`。根 `gen:api` 改为：api `openapi` → api-client `gen:api` → miniprogram `gen:api`。
- `src/client.ts`：`createClient<paths>({ baseUrl: "/" })`、`ApiError`、`unwrap`，`CODES` 从 `ApiErrorCode` 枚举派生（不再手写数组）。
- `src/types.ts`：现有 web + admin `types.ts` 的并集（含 `JobListQuery` 的注释与 Required 修正、`StudentsQuery / QuestionsQuery / JobsQuery`）。
- 测试：把 `client.test.ts` 搬进来（vitest）。
- 应用侧：`queries.ts / mutations.ts` 改 `import { client, unwrap } from "@job-hunt/api-client/client"`、`import type { … } from "@job-hunt/api-client/types"`；web 的 `@entities/job|quiz` 门面继续 re-export（改 import 源）。`@api/*` 别名保留给 `queries / mutations`。

## 3. apps/web 迁移

- 删 `src/shared/ui/*`、`src/shared/lib/cn.ts`、`src/api/{client,client.test,types,schema.d}.ts`、`src/styles/tokens.css`；`globals.css` 改为引包。
- 替换：`Button → @job-hunt/ui/components/button`（原 `blueprint` prop 保留，实现搬进 ui 包的 Button）；`Tag → Badge`；`Input`；`Kicker`；`DataTable`（`JobTable` 的列定义不变）；`AccessBanner` / `ProPage` 的手写 link-as-button 改 `<Button asChild><Link …/></Button>`；`BankPickerPage` 进度条改 `ProgressBar`；`JobFilters` 的防抖改 `useDebouncedSearch`；`ErrorPanel` 改为 `routes/-error.tsx` 里 `RouterErrorPanel`（包 `ErrorPanel` + `router.invalidate`）。
- `tsconfig` paths 删 `@shared/ui`（`@shared/lib` 若还剩别的文件保留）。
- Segmented 组件（`shared/ui/Segmented.tsx`，仅 web 用）搬到 `@job-hunt/ui/components/segmented`。

## 4. apps/admin 迁移

- 同 §3 的删除 / 替换；`AuthErrorPanel` 保留在 admin（router + 业务）。
- **表格**：Students / Jobs / Questions / Materials / Courses 五页改 `DataTable`，列定义各自文件内 `const columns: Column<X>[]`；`th / td` 常量删除。
- **表单**：六个 Dialog（PlanDialog、GrantsDialog、JobDialog、QuestionDialog、CategoryDialog、CompanyDialog、MaterialDialog、CourseDialog、ImportResultDialog 除外）改为 `FormDialog` + `useForm({ resolver: zodResolver(schema) })`：
  - 每个表单一个 `schema.ts`：zod schema（`z.object`）+ `toBody(values)`（schema 输出 → API body）+ `fromEntity(entity)`（实体 → 表单默认值）。现有 `job-form.ts / question-form.ts / grant-rows.ts / lesson-rows.ts` 的校验逻辑迁进 schema（文案不变），测试改为对 schema 的 `safeParse` + `toBody` 断言，用例数不减少。
  - 课时 / 授权行编辑器用 RHF `useFieldArray`。
  - 提交：`form.handleSubmit(async (v) => { await mutate(toBody(v)); onClose(); })`；mutation 错误显示在 `FormDialog.error`。
- 防抖：`useDebouncedSearch`。
- `mutations.ts` 的 `invalidate(qc, ...keys)` 保留。

## 5. apps/api 去重

- `src/lib/route.ts`：`jsonContent(schema, description)`、`errorContent(description)`（`ApiErrorSchema`）、`ERRORS = { badRequest, unauthorized, forbidden, notFound }` 预制响应；`orNotFound<T>(row: T | null, message): T`（`null` → `NotFoundError`）。各路由文件删除本地 `err / json / jsonContent` 定义，`findUnique(...select id) + throw NotFoundError` 改为 `orNotFound(await prisma.x.findUnique(...), "…不存在")`。
- `src/test/http.ts`：`jsonInit(method, body)`、`adminRequestJson(path, method, body)`；`jobs.test.ts / admin.test.ts / quiz.test.ts` 改用。
- `src/routes/admin/*.ts` 里重复的"公司 / 分类存在性校验"抽到 `src/services/banks.ts`（`assertCategory(id)`、`assertCompany(id)`），导入 / 题目 / 分类路由共用。
- 不改契约、不改 `openapi.json`（`pnpm openapi:check` 必须无 diff）。

## 6. 根目录

- `pnpm-workspace.yaml`：`packages: [apps/*, packages/*]`。
- 根 `package.json`：`gen:api` 改链；`typecheck / lint / test` 已是 `-r --if-present`，包会被覆盖。
- `AGENTS.md`：加"通用组件在 `packages/ui`，接口类型在 `packages/api-client`；应用里不要再复制组件；样式只用 Tailwind 类与令牌，内联 `style` 只允许动态尺寸（进度条）"。
- README：包结构一节。

## 7. 验收

- 根目录 `pnpm install`（新依赖）、`pnpm typecheck && pnpm lint && pnpm test && pnpm build` 全绿；`apps/api` `pnpm openapi:check` 无 diff。
- 浏览器回归：web 看板（筛选防抖、分页、收藏）、登录、刷题（含多选）、`/pro`；admin 登录、学生（档位 / 授权对话框）、岗位（新增 / 编辑 / 导入）、题库（树 / 新增多选题 / 导入）、资料、课程（课时增删排序）。观感与重构前一致。
- `grep -rn "style={{" apps packages` 只剩 `progress-bar.tsx` 与 `data-table.tsx` 的 `<col width>`。
