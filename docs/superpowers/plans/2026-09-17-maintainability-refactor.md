# 可维护性重构实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 抽出 `@job-hunt/ui`（shadcn/ui + Industry 令牌）与 `@job-hunt/api-client` 两个 workspace 包，web / admin 改为引用；admin 表格与表单统一（DataTable、FormDialog + react-hook-form + zod）；后端路由 / 测试去重。行为与观感不变。

**Architecture:** 源码包（不构建），`exports` 直指 `src/`；Tailwind v4 通过 `@source` 扫描包内类名；令牌保留现有 `@theme` 名字并映射到 shadcn 变量，`--radius: 0`。

**Tech Stack:** React 19、Tailwind v4、shadcn/ui（new-york，`radix-ui`）、cva、tailwind-merge、react-hook-form 7 + @hookform/resolvers、zod 4、TanStack Router / Query、openapi-fetch、Hono、vitest、Biome。

**Spec:** `docs/superpowers/specs/2026-09-17-maintainability-refactor-design.md`

## Global Constraints

- monorepo `/Users/black/Desktop/job_hunt`，分支 `refactor/shared-packages`（基线 main ee68418）。命令前 `source ~/.nvm/nvm.sh && nvm use`；只用 pnpm，在**根目录** `pnpm install`，只维护根 `pnpm-lock.yaml`。
- 每个任务结束前根目录 `pnpm typecheck && pnpm lint && pnpm test && pnpm build` 全绿（api 测试打 `.env` 的 `TEST_DATABASE_URL`）；`apps/api` 的 `pnpm openapi:check` 无 diff（本计划不改契约）。
- 不改业务行为、不改契约、不改 `openapi.json`、不改小程序。
- 不提交 `.env*`（`.env.example` 除外）、`dist`、`node_modules`、`src/generated`、`package-lock.json`。
- 样式只用 Tailwind 类与令牌；内联 `style` 只允许动态尺寸（进度条宽度、表格 `<col width>`）。
- 提交信息中文 Conventional 前缀（`refactor(...)`），结尾一行 `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`。不 push（控制者统一处理）。
- 不要启动 / 停止 3000 / 3001 / 5173 端口；验证用 web 5175、admin 5176（后端 3001 已在跑，开发库里 `13800138000` 是管理员）。

---

### Task 1: `packages/ui` 与 `packages/api-client`

**Files:**
- Create: `packages/ui/{package.json,tsconfig.json,biome.json,components.json,src/styles/tokens.css,src/styles/globals.css,src/lib/utils.ts,src/components/*.tsx,src/hooks/*.ts}`
- Create: `packages/api-client/{package.json,tsconfig.json,src/schema.d.ts,src/client.ts,src/client.test.ts,src/types.ts,vitest.config.ts}`
- Modify: `pnpm-workspace.yaml`, 根 `package.json`（`gen:api` 链）, `AGENTS.md`, `README.md`

**Interfaces（后续任务依赖）:**
- `@job-hunt/ui/components/button`：`Button { variant?: "primary"|"secondary"|"ghost"|"destructive"; size?: "sm"|"md"|"lg"; blueprint?: boolean; asChild?: boolean }`（默认 `secondary`/`md`，与现有 web/admin `Button` 语义一致）。
- `@job-hunt/ui/components/badge`：`Badge { variant?: "neutral"|"accent"|"outline" }`。
- `@job-hunt/ui/components/{input,textarea,label,checkbox,radio-group,select,dialog,form,table,separator,alert}`：shadcn 标准导出。
- `@job-hunt/ui/components/kicker`：`Kicker { className? }`。
- `@job-hunt/ui/components/stat-card`：`StatCard { label, value, hint?, children? }`（不含路由链接；需要链接时外层用 `<Link>` 包裹或传 `asChild`）。
- `@job-hunt/ui/components/pagination`：`Pagination { page, pageSize, total, onChange(page) }`。
- `@job-hunt/ui/components/progress-bar`：`ProgressBar { value: number; className? }`。
- `@job-hunt/ui/components/data-table`：`Column<T> = { id: string; header: string; headerSrOnly?: boolean; width?: string; align?: "left"|"right"; cell: (row: T) => ReactNode }`；`DataTable<T> { columns; rows; rowKey(row); caption; emptyMessage?; renderCard?(row); minWidthClassName? }`——`renderCard` 提供时窄屏渲染卡片列表（web 看板用），不提供时始终渲染表格。
- `@job-hunt/ui/components/form-dialog`：`FormDialog<TFieldValues> { open; title; description?; onClose(); form: UseFormReturn<TFieldValues>; onSubmit: SubmitHandler<TFieldValues>; submitLabel?; cancelLabel?; pending?; error?: string | null; wide?: boolean; children }`。
- `@job-hunt/ui/components/error-panel`：`ErrorPanel { error: unknown; onRetry?(); home?: ReactNode }`。
- `@job-hunt/ui/components/segmented`：从 `apps/web/src/shared/ui/Segmented.tsx` 搬来，props 不变。
- `@job-hunt/ui/hooks/use-debounced-search`：`useDebouncedSearch(committed: string, commit: (next: string) => void, ms = 300): [draft: string, setDraft: (v: string) => void]`（`committed` 外部变化时同步 draft；draft 变化 ms 后 trim 并 commit；相同值不 commit）。
- `@job-hunt/ui/lib/utils`：`cn`。
- `@job-hunt/api-client/client`：`client, unwrap, ApiError`；`@job-hunt/api-client/types`：web + admin 现有 `types.ts` 的并集。

- [ ] **Step 1: workspace 与包骨架**

`pnpm-workspace.yaml` 的 `packages` 加 `packages/*`。`packages/ui/package.json`：

```json
{
  "name": "@job-hunt/ui", "version": "0.1.0", "private": true, "type": "module",
  "exports": {
    "./components/*": "./src/components/*.tsx",
    "./hooks/*": "./src/hooks/*.ts",
    "./lib/*": "./src/lib/*.ts",
    "./styles/*": "./src/styles/*.css"
  },
  "scripts": { "typecheck": "tsc --noEmit", "lint": "biome check ." },
  "peerDependencies": { "react": "^19", "react-dom": "^19" },
  "dependencies": { "radix-ui": "latest", "class-variance-authority": "^0.7", "clsx": "^2", "tailwind-merge": "^3", "lucide-react": "latest", "react-hook-form": "^7", "@hookform/resolvers": "^5", "zod": "^4.5.4" },
  "devDependencies": { "@types/react": "^19", "@types/react-dom": "^19", "typescript": "7.0.2", "@biomejs/biome": "2.5.13", "tailwindcss": "^4" }
}
```
（`latest` 安装后固定成实际版本号。）`tsconfig.json` 同 web（去掉 paths，`include: ["src"]`，`jsx: react-jsx`，`types: []`）。`biome.json` 复制 web 的（`files.includes` 去掉 web 专有排除）。

`packages/api-client/package.json`：`exports { "./client": "./src/client.ts", "./types": "./src/types.ts" }`，scripts `gen:api`（`pnpm dlx openapi-typescript@7 "${OPENAPI_SOURCE:-../../apps/api/openapi.json}" -o src/schema.d.ts`）、`typecheck`、`test`（vitest）；deps `openapi-fetch ^0.17`；`biome.json` 排除 `src/schema.d.ts`。

- [ ] **Step 2: 令牌与全局样式**

`src/styles/tokens.css` = 现有 `apps/web/src/styles/tokens.css` 全文 + 追加：

```css
:root {
  --background: var(--color-bg); --foreground: var(--color-text);
  --card: var(--color-surface); --card-foreground: var(--color-text);
  --popover: var(--color-bg); --popover-foreground: var(--color-text);
  --primary: var(--color-accent); --primary-foreground: var(--color-bg);
  --secondary: var(--color-surface); --secondary-foreground: var(--color-text);
  --muted: var(--color-neutral-200); --muted-foreground: var(--color-neutral-700);
  --accent: var(--color-accent-100); --accent-foreground: var(--color-accent-700);
  --destructive: #b91c1c; --border: var(--color-divider); --input: var(--color-divider); --ring: var(--color-accent);
  --radius: 0rem;
}
@theme inline {
  --color-background: var(--background); --color-foreground: var(--foreground);
  --color-card: var(--card); --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover); --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary); --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary); --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted); --color-muted-foreground: var(--muted-foreground);
  --color-destructive: var(--destructive); --color-border: var(--border); --color-input: var(--input); --color-ring: var(--ring);
  --radius-sm: 0; --radius-md: 0; --radius-lg: 0; --radius-xl: 0;
}
```
注意现有令牌已有 `--color-accent`（钢蓝）及 `accent-100…900`，shadcn 的 `--accent` 语义是"悬停底色"，**不要**把 `--color-accent` 覆盖掉——`@theme inline` 里不要再定义 `--color-accent`，让 `bg-accent` 继续指钢蓝；shadcn 组件里需要悬停底色的地方改用 `bg-accent-100`。

`src/styles/globals.css`：`@import "tailwindcss"; @import "./tokens.css"; @source "../";` + 现有 web `globals.css` 的 `@layer base`（原样搬，含 `.blueprint` / `.corner` 规则）。

- [ ] **Step 3: shadcn 组件**

`packages/ui/components.json`：`{ "style": "new-york", "tailwind": { "css": "src/styles/globals.css", "baseColor": "neutral", "cssVariables": true }, "aliases": { "components": "@/components", "utils": "@/lib/utils", "ui": "@/components" }, "tsx": true }`，`tsconfig` 加 `paths: { "@/*": ["./src/*"] }`（仅供 CLI；生成后把组件里的 `@/lib/utils` 改成相对路径 `../lib/utils`，避免应用侧解析 `@/`）。`pnpm dlx shadcn@latest add button badge input textarea label checkbox radio-group select dialog form table separator alert`。然后按 Interfaces 调整 `button.tsx`（variants 改为 `primary | secondary | ghost | destructive`，sizes `sm | md | lg`，class 用现有 web `Button.tsx` 的样式：`border font-heading font-semibold …`，`blueprint` 角标渲染逻辑搬入）与 `badge.tsx`（`neutral | accent | outline`，样式取现有 `Tag.tsx`）。`select.tsx` / `dialog.tsx` 的圆角类（`rounded-*`）保留即可——`--radius: 0` 使其为直角。

- [ ] **Step 4: 自定义组件与 hooks**

按 Interfaces 写 `kicker.tsx`（现有 Kicker 样式）、`stat-card.tsx`（现有 admin StatCard 样式，去掉 Link）、`pagination.tsx`（现有 admin 实现）、`progress-bar.tsx`（`<div class="h-1.5 bg-hairline"><div class="h-full bg-accent" style={{ width: `${clamp}%` }} /></div>`，注释说明这是唯一允许的内联样式）、`data-table.tsx`（基于 shadcn `table.tsx` 的 `Table/TableHeader/…`；`renderCard` 缺省时不渲染卡片列表；表头样式 `text-[11px] uppercase tracking-[0.08em] text-neutral-700`、行 `border-b border-hairline`，与现有两端一致）、`form-dialog.tsx`（shadcn `Dialog` + `Form`；`error` 渲染 `<Alert variant="destructive" role="alert">`；footer `Button variant="secondary"` 取消 + `Button variant="primary" type="submit" disabled={pending}`；Esc / 遮罩在 `pending` 时不关闭）、`error-panel.tsx`、`segmented.tsx`；`hooks/use-debounced-search.ts`、`hooks/use-debounced-value.ts`。

- [ ] **Step 5: api-client**

`pnpm --filter @job-hunt/api-client gen:api`（产出 `src/schema.d.ts`，提交）。`client.ts`：现有 web `client.ts`，`CODES` 改为 `const CODES: ApiErrorCode[] = ["VALIDATION","UNAUTHORIZED","FORBIDDEN","CODE_INVALID","RATE_LIMITED","NOT_FOUND","INTERNAL"] satisfies ApiErrorCode[]`（类型驱动，漏一个会编译报错）。`types.ts`：合并 web 与 admin 的 `types.ts`（保留 `JobListQuery` 注释）。`client.test.ts` 搬入（vitest，`vitest.config.ts` 最简）。

- [ ] **Step 6: 根脚本与文档**

根 `package.json`：`"gen:api": "pnpm --filter job-hunt-back openapi && pnpm --filter @job-hunt/api-client gen:api && pnpm --filter job-hunt-miniprogram gen:api"`。`AGENTS.md` 加 spec §6 的三句约定；README 加「packages/」一节。`pnpm install`，根目录四件套全绿（此时 apps 尚未引用包，包自身 `typecheck / lint / test` 必须过）。提交 `refactor(packages): 新增 @job-hunt/ui（shadcn + Industry 令牌）与 @job-hunt/api-client`。

---

### Task 2: apps/web 迁移

**Files:**
- Delete: `apps/web/src/shared/ui/*`, `apps/web/src/shared/lib/cn.ts`, `apps/web/src/api/{client,client.test,types,schema.d}.ts`, `apps/web/src/styles/tokens.css`
- Modify: `apps/web/package.json`（deps 加 `"@job-hunt/ui": "workspace:*"`, `"@job-hunt/api-client": "workspace:*"`；删 `gen:api` 脚本与 `openapi-fetch` 依赖）, `apps/web/src/styles/globals.css`, `apps/web/tsconfig.json`, `apps/web/vite.config.ts`（alias 删 `@shared`？——`@shared/lib` 若无剩余文件则删）, `apps/web/biome.json`（去掉 schema.d.ts 排除）, `apps/web/AGENTS.md`
- Modify: 所有引用 `@shared/ui/*`、`@shared/lib/cn`、`@api/client`、`@api/types` 的文件（`grep -rl` 找）；`src/entities/{job,quiz}/index.ts` 改从 `@job-hunt/api-client/types` re-export；`routes/__root.tsx`、各路由 `errorComponent` 改用 `routes/-error.tsx` 的 `RouterErrorPanel`（包 `ErrorPanel`，`onRetry = router.invalidate + reset`，`home = <Link to="/">返回岗位看板</Link>`）；`widgets/access-banner/AccessBanner.tsx` 与 `views/pro/ProPage.tsx` 的手写链接按钮改 `<Button asChild variant="primary"><Link …/></Button>`；`views/practice/BankPickerPage.tsx` 进度条改 `ProgressBar`；`features/job-filters/JobFilters.tsx` 防抖改 `useDebouncedSearch`；`widgets/job-table/JobTable.tsx` 改包 `DataTable`（列定义不变）；`Tag → Badge`。

- [ ] **Step 1:** 依赖与样式接线：`globals.css` 改为 `@import "@job-hunt/ui/styles/globals.css";` + `:root { --font-barlow…}`；`pnpm install`。
- [ ] **Step 2:** 按文件替换 import，删除旧文件；`tsconfig` paths 去掉不存在的目录。
- [ ] **Step 3:** 四件套全绿；`pnpm --filter job-hunt-front dev --port 5175` 浏览器回归：看板（筛选防抖、分页、收藏 / 投递、CSV 导出按钮）、`/login`、`/practice` 与刷题页（多选题）、`/pro`；对比重构前截图（可先在 main 起一份看一眼）确保观感一致；停 5175。提交 `refactor(web): 改用 @job-hunt/ui 与 @job-hunt/api-client`。

---

### Task 3: apps/admin 迁移（表格 + 表单）

**Files:**
- Delete: `apps/admin/src/shared/ui/*`（`AuthErrorPanel.tsx` 除外，改为引用包 `ErrorPanel` 并保留 auth 逻辑）, `apps/admin/src/shared/lib/cn.ts`, `apps/admin/src/api/{client,client.test,types,schema.d}.ts`, `apps/admin/src/styles/tokens.css`
- Modify: `apps/admin/package.json`, `globals.css`, `tsconfig.json`, `biome.json`, `AGENTS.md`；`src/api/{queries,mutations}.ts` 的 import；`views/dashboard/DashboardPage.tsx`（`StatCard` 外包 `Link`）；`views/students/{StudentsPage,PlanDialog,GrantsDialog}.tsx` + `grant-rows.ts` → `grants-schema.ts`；`views/jobs/{JobsPage,JobDialog,ImportResultDialog}.tsx` + `job-form.ts` → `job-schema.ts`；`views/questions/{QuestionsPage,QuestionDialog,CategoryDialog,CompanyDialog,ImportQuestionsDialog,BankTree}.tsx` + `question-form.ts` → `question-schema.ts`；`views/materials/{MaterialsPage,MaterialDialog}.tsx` → `material-schema.ts`；`views/courses/{CoursesPage,CourseDialog}.tsx` + `lesson-rows.ts` → `course-schema.ts`；对应 `*.test.ts` 改为 schema 测试；`widgets/sidebar/Sidebar.tsx`、`views/login/LoginPage.tsx` 的组件 import。

**Interfaces:** 每个 `*-schema.ts` 导出 `schema`（zod）、`type FormValues = z.infer<typeof schema>`、`defaultValues`、`fromEntity(entity): FormValues`（编辑预填）、`toBody(values): <API body>`。校验文案沿用现有 `toXBody` 的文案（如「请填写企业名称」「多选题至少选两个正确答案」「第 n 课时缺少标题或视频链接」），跨字段规则用 `superRefine`。

- [ ] **Step 1:** 接线同 Task 2 Step 1–2（先让 typecheck 过，再做下面两步）。
- [ ] **Step 2: 表格**：五页改 `DataTable`（`columns: Column<AdminX>[]` 常量放页面文件顶部；操作列 `cell` 里的按钮用 `Button size="sm"`）；删 `th / td` 常量；三处防抖改 `useDebouncedSearch`。
- [ ] **Step 3: 表单**（先改测试再改实现，每个表单一个提交）：
  - `job-schema.ts`：字段 `categoryId: z.enum(["1","2","3"])`、`enterpriseName / position: z.string().trim().min(1, "请填写…")`、其余 `z.string()`、`deadlineAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "截止日期格式为 YYYY-MM-DD").or(z.literal(""))`；`toBody` 空串 → null。`JobDialog` 用 `FormField` 渲染 14 个字段（两列 grid）。
  - `question-schema.ts`：`type`、`options: z.array(z.string()).min(2).max(6)`、`answer: z.array(letter)`；`superRefine`：按题型校验（文案同现有）；`QuestionDialog` 用 `useFieldArray` 管选项，`watch("type")` 切换 JUDGE 时 `setValue("options", ["正确","错误"])`、`setValue("answer", [])`；单选 / 判断 `RadioGroup`，多选 `Checkbox`。
  - `grants-schema.ts`：`grants: z.array({ contentType, contentId: z.string().trim(), expiresAt: z.string() })`，`toBody` 去掉空 `contentId` 行、日期转 ISO；`GrantsDialog` 用 `useFieldArray`；`PlanDialog`：`plan`、`proExpiresAt`。
  - `course-schema.ts`：`lessons` 数组 + `superRefine` 逐行文案「第 n 课时缺少标题或视频链接」、URL 前缀校验；上移 / 下移用 `useFieldArray` 的 `move`。
  - `material-schema.ts`、`category-schema.ts`（公司 / 分类共用 `{ name }`）。
  - `ImportResultDialog` / `ImportQuestionsDialog` 不是表单，改用包 `Dialog` 即可。
- [ ] **Step 4:** 四件套全绿（测试用例数 ≥ 重构前 20）；`pnpm --filter job-hunt-admin dev --port 5176` 浏览器回归：学生（停用 / 档位 / 授权保存）、岗位（新增校验文案、编辑、删除、导入）、题库（树、新增多选题、切换判断题、导入 xlsx）、资料、课程（课时增删上移下移保存）；停 5176。提交（可多次）`refactor(admin): DataTable / FormDialog + react-hook-form 重写列表与表单`。

---

### Task 4: apps/api 去重

**Files:**
- Create: `apps/api/src/lib/route.ts`, `apps/api/src/test/http.ts`, `apps/api/src/services/banks.ts`
- Modify: `apps/api/src/routes/{auth,jobs,quiz,me,content}.ts`, `apps/api/src/routes/admin/{companies,content,jobs,questions,students,summary}.ts`, `apps/api/src/routes/*.test.ts`, `apps/api/src/lib/import-questions.ts`（用 `assertCategory`）

- [ ] **Step 1: `src/lib/route.ts`**

```ts
export const jsonContent = <S>(schema: S, description: string) => ({ description, content: { "application/json": { schema } } });
export const errorContent = (description: string) => jsonContent(ApiErrorSchema, description);
export const ERRORS = { badRequest: errorContent("参数校验失败"), unauthorized: errorContent("未登录"), forbidden: errorContent("没有权限"), notFound: errorContent("不存在") } as const;
export function orNotFound<T>(row: T | null | undefined, message: string): T { if (row == null) throw new NotFoundError(message); return row; }
```
各路由文件删除本地 `err / json / jsonContent`，`responses` 用 `jsonContent(...)` / `ERRORS.*`；`findUnique + if (!x) throw NotFoundError` 改 `orNotFound(...)`。

- [ ] **Step 2: `src/services/banks.ts`**：`assertCompany(id)` / `assertCategory(id)`（不存在 → `AppError(400, "VALIDATION", …)` 或 `NotFoundError`，按各路由现有语义各提供一个变体：`requireCategory`（404）与 `assertCategoryRef`（400））；`companies.ts / questions.ts / import-questions.ts` 改用。
- [ ] **Step 3: `src/test/http.ts`**：`export const jsonInit = (method: string, body: unknown): RequestInit => ({ method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) })`；三个测试文件改用（删本地 `json`）。
- [ ] **Step 4:** `pnpm openapi:check` 无 diff；四件套全绿；提交 `refactor(api): 路由响应片段 / 存在性校验 / 测试请求辅助去重`。

---

## 自检记录

- 覆盖：spec §2 → T1；§3 → T2；§4 → T3；§5 → T4；§6 → T1 Step 6；§7 由控制者最终回归。
- 接口一致：`Button` variants / `Badge` variants / `DataTable.Column` / `FormDialog` props 在 T1 定义、T2 / T3 使用；`useDebouncedSearch` 签名统一；`@job-hunt/api-client/types` 为两端 `types.ts` 并集，T2 / T3 只改 import 路径。
- 无占位：包名、exports、令牌映射、文案、脚本均写明。
