# 后台管理系统 job_hunt_admin 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 ChatGPT 交付的管理员后端之上，完善 `/api/admin/*`（概览、学生、资料 / 课程、题库、岗位含 Excel 导入），并新建独立管理端仓库 `job_hunt_admin`。

**Architecture:** 后端 `job_hunt_back` 在分支 `feat/admin-api` 上把 `src/routes/admin.ts` 拆成 `src/routes/admin/` 目录（每个资源一个文件，共享 `assertAdmin` 中间件），契约 `src/contract/admin.ts` 重写为分页列表 + 单资源 DTO；`openapi.json` 每个任务重新生成。管理端 `job_hunt_admin` 是 `job_hunt_front` 同栈的新 Vite 应用（React 19 + TanStack Router / Query + Tailwind v4 + openapi-fetch），受保护布局 `_admin` 用 `/api/me.role` 守卫，六个页面各自一个 `views/<page>/` 目录，表单转换逻辑抽成可测纯函数。

**Tech Stack:** Hono 4 + `@hono/zod-openapi` 1.6、Prisma 7、ExcelJS、vitest；React 19、Vite 8、TanStack Router 1.170 / Query 5、openapi-fetch 0.17、Tailwind v4、Biome 2.5、TypeScript 7、pnpm 12、Node 22。

**Spec:** `docs/superpowers/specs/2026-09-14-admin-console-design.md`（本仓库 `job_hunt_front`）

## Global Constraints

- 后端仓库 `/Users/black/Desktop/job_hunt_back`，分支 `feat/admin-api`（基线 main 7cb69de）。管理端仓库 `/Users/black/Desktop/job_hunt_admin`，直接在 `main` 上提交。学生端 `job_hunt_front` 本计划**不改代码**。
- 命令前 `source ~/.nvm/nvm.sh && nvm use 22`；只用 pnpm。
- 后端每个任务结束前：`pnpm openapi`（重新生成 `openapi.json` 并一起提交）、`pnpm typecheck && pnpm lint && pnpm test`。集成测试用 `.env` 里的 `TEST_DATABASE_URL`（库名以 `_test` 结尾），不要动 5432 上的开发库数据以外的任何库，不要停 / 启任何 PostgreSQL。
- 管理端每个任务结束前：`pnpm typecheck && pnpm lint && pnpm test`。`src/api/schema.d.ts` 只能由 `OPENAPI_SOURCE=/Users/black/Desktop/job_hunt_back/openapi.json pnpm gen:api` 生成，不能手改。
- 不提交：`.env`、`src/generated`、`dist`、`node_modules`、`package-lock.json`。
- `z` 从 `@hono/zod-openapi` 导入；请求体一律 `required: true`；可空引用用 `z.union([Schema, z.null()])`（`.nullable()` 会被烘进已注册组件）；带 `.openapi("Name")` 的 schema 名称全局唯一。
- 错误：业务错误抛 `AppError(status, code, message)`（`src/lib/errors.ts`），不存在抛 `NotFoundError`；不要让路由抛 500。
- 提交信息中文、Conventional 前缀（`feat(admin): …`），结尾一行 `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`。
- 不要启动 / 停止 3000 端口的任何东西；验证用后端 3001、管理端 5174，只停自己起的进程。
- 管理端 UI 文案中文；风格沿用 front 的 `tokens.css`（`bg-bg / bg-surface / border-divider / text-accent-700 / font-heading`）。

---

### Task 1（后端）: 契约重写、admin 目录拆分、概览 / 学生 / 资料课程端点

**Files:**
- Modify: `src/contract/admin.ts`（整文件重写）
- Delete: `src/routes/admin.ts`
- Create: `src/routes/admin/index.ts`, `src/routes/admin/guard.ts`, `src/routes/admin/summary.ts`, `src/routes/admin/students.ts`, `src/routes/admin/content.ts`
- Modify: `src/app.ts`（import 路径 `./routes/admin` 不变，目录 index 接管）, `src/routes/content.ts`（改读 `c.var.role`）
- Test: `src/routes/admin.test.ts`（整文件重写）
- Modify: `README.md`（「后台管理」一节）, `openapi.json`（生成）

**Interfaces:**
- Produces: `src/routes/admin/guard.ts` 导出 `adminGuard`（Hono 中间件）与 `newAdminRouter()`；Task 2 / 3 各自新建文件并在 `index.ts` 里 `router.route("/", …)` 挂载。契约中 Task 2 / 3 用到的 schema（题库、岗位）也在本任务一次写全。

- [ ] **Step 1: 重写 `src/contract/admin.ts`**

```ts
import { z } from "@hono/zod-openapi";
import { PlanSchema, TierSchema } from "./access";
import { CategoryIdSchema, jobListQuerySchema } from "./job";
import { QuizOptionLetterSchema, QuizOptionSchema } from "./quiz";

export const ContentTypeSchema = z.enum(["MATERIAL", "QUESTION", "COURSE"]).openapi("ContentType");
const NullableDateTime = z.string().datetime().nullable();
const DateKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日期格式为 YYYY-MM-DD");
const BoolQuery = z
  .enum(["true", "false"])
  .transform((v) => v === "true")
  .optional();

const pageQuery = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
};
const paged = <T extends z.ZodTypeAny>(item: T, name: string) =>
  z
    .object({ items: z.array(item), total: z.number().int(), page: z.number().int(), pageSize: z.number().int() })
    .openapi(name);

export const IdResultSchema = z.object({ id: z.string() }).openapi("IdResult");
export const IntIdResultSchema = z.object({ id: z.number().int() }).openapi("IntIdResult");

// ── 概览 ──
export const AdminSummarySchema = z
  .object({
    students: z.number().int(),
    enabledStudents: z.number().int(),
    proStudents: z.number().int(),
    guests: z.number().int(),
    jobs: z.number().int(),
    questions: z.number().int(),
    publishedQuestions: z.number().int(),
    materials: z.number().int(),
    courses: z.number().int(),
  })
  .openapi("AdminSummary");

// ── 学生 ──
export const adminStudentQuerySchema = z.object({
  q: z.string().trim().min(1).optional(),
  plan: PlanSchema.optional(),
  enabled: BoolQuery,
  ...pageQuery,
});
export const AdminGrantSchema = z
  .object({
    id: z.string(),
    contentType: ContentTypeSchema,
    contentId: z.string(),
    contentTitle: z.string().nullable(),
    expiresAt: NullableDateTime,
  })
  .openapi("AdminGrant");
export const AdminStudentSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    phone: z.string().nullable(),
    role: z.enum(["STUDENT", "ADMIN"]),
    enabled: z.boolean(),
    plan: PlanSchema,
    proExpiresAt: NullableDateTime,
    tier: TierSchema,
    createdAt: z.string().datetime(),
    stats: z.object({ favorites: z.number().int(), applications: z.number().int(), attempts: z.number().int() }),
    grants: z.array(AdminGrantSchema),
  })
  .openapi("AdminStudent");
export const AdminStudentListSchema = paged(AdminStudentSchema, "AdminStudentList");
export const AdminStudentPatchSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    enabled: z.boolean().optional(),
    plan: PlanSchema.optional(),
    proExpiresAt: NullableDateTime.optional(),
  })
  .openapi("AdminStudentPatch");
export const AdminAccessBodySchema = z
  .object({
    grants: z.array(
      z.object({ contentType: ContentTypeSchema, contentId: z.string().min(1), expiresAt: NullableDateTime.optional() }),
    ),
  })
  .openapi("AdminAccessBody");

// ── 资料 / 课程 ──
export const AdminMaterialSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    description: z.string().nullable(),
    category: z.string(),
    resourceUrl: z.string(),
    published: z.boolean(),
    updatedAt: z.string().datetime(),
  })
  .openapi("AdminMaterial");
export const AdminCourseLessonSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    videoUrl: z.string(),
    durationMinutes: z.number().int().nullable(),
    sortOrder: z.number().int(),
  })
  .openapi("AdminCourseLesson");
export const AdminCourseSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    description: z.string().nullable(),
    coverUrl: z.string().nullable(),
    published: z.boolean(),
    updatedAt: z.string().datetime(),
    lessons: z.array(AdminCourseLessonSchema),
  })
  .openapi("AdminCourse");
const AdminCourseLessonBodySchema = z.object({
  title: z.string().min(1),
  videoUrl: z.string().url(),
  durationMinutes: z.number().int().positive().nullable().optional(),
});
const AdminMaterialBodySchema = z
  .object({
    type: z.literal("MATERIAL"),
    id: z.string().optional(),
    title: z.string().min(1),
    description: z.string().nullable().optional(),
    category: z.string().optional(),
    url: z.string().url(),
    published: z.boolean(),
  })
  .openapi("AdminMaterialBody");
const AdminCourseBodySchema = z
  .object({
    type: z.literal("COURSE"),
    id: z.string().optional(),
    title: z.string().min(1),
    description: z.string().nullable().optional(),
    coverUrl: z.string().url().nullable().optional(),
    published: z.boolean(),
    lessons: z.array(AdminCourseLessonBodySchema),
  })
  .openapi("AdminCourseBody");
export const AdminContentBodySchema = z
  .discriminatedUnion("type", [AdminMaterialBodySchema, AdminCourseBodySchema])
  .openapi("AdminContentBody");

// ── 题库 ──
export const AdminQuizMetaSchema = z
  .object({
    categories: z.array(z.object({ id: z.string(), name: z.string(), questionCount: z.number().int() })),
    companySets: z.array(z.object({ id: z.string(), company: z.string(), track: z.string(), focus: z.string() })),
  })
  .openapi("AdminQuizMeta");
export const adminQuestionQuerySchema = z.object({
  q: z.string().trim().min(1).optional(),
  categoryId: z.string().min(1).optional(),
  published: BoolQuery,
  ...pageQuery,
});
export const DifficultySchema = z.enum(["EASY", "MEDIUM", "HARD"]).openapi("Difficulty");
export const AdminQuestionSchema = z
  .object({
    id: z.string(),
    prompt: z.string(),
    categoryId: z.string(),
    categoryName: z.string(),
    companySetId: z.string().nullable(),
    options: z.array(QuizOptionSchema),
    answer: QuizOptionLetterSchema,
    explanation: z.array(z.string()),
    difficulty: DifficultySchema,
    source: z.string(),
    published: z.boolean(),
  })
  .openapi("AdminQuestion");
export const AdminQuestionListSchema = paged(AdminQuestionSchema, "AdminQuestionList");
export const AdminQuestionBodySchema = z
  .object({
    prompt: z.string().min(1),
    categoryId: z.string().min(1),
    companySetId: z.string().nullable().optional(),
    options: z.array(QuizOptionSchema).length(4),
    answer: QuizOptionLetterSchema,
    explanation: z.array(z.string()),
    difficulty: DifficultySchema,
    source: z.string().min(1),
    published: z.boolean(),
  })
  .openapi("AdminQuestionBody");
export const AdminQuestionPatchSchema = AdminQuestionBodySchema.partial().openapi("AdminQuestionPatch");
export const AdminCategoryBodySchema = z.object({ name: z.string().trim().min(1).max(30) }).openapi("AdminCategoryBody");
export const AdminCategorySchema = z.object({ id: z.string(), name: z.string() }).openapi("AdminCategory");

// ── 岗位 ──
export const adminJobQuerySchema = z.object({
  q: z.string().trim().min(1).optional(),
  category: jobListQuerySchema.shape.category,
  ...pageQuery,
});
const NullableText = z.string().nullable();
export const AdminJobSchema = z
  .object({
    id: z.number().int(),
    serialNumber: NullableText,
    categoryId: CategoryIdSchema,
    recruitmentBatch: NullableText,
    enterpriseNature: NullableText,
    industry: NullableText,
    workLocation: NullableText,
    position: z.string(),
    enterpriseName: z.string(),
    graduationYear: NullableText,
    degree: NullableText,
    announcementLink: NullableText,
    deliveryAddress: NullableText,
    deadline: NullableText,
    deadlineAt: DateKeySchema.nullable(),
    createTime: z.string().datetime(),
    updateTime: z.string().datetime(),
    stats: z.object({ favorites: z.number().int(), applications: z.number().int() }),
  })
  .openapi("AdminJob");
export const AdminJobListSchema = paged(AdminJobSchema, "AdminJobList");
const OptText = z.string().nullable().optional();
export const AdminJobBodySchema = z
  .object({
    categoryId: CategoryIdSchema,
    position: z.string().trim().min(1),
    enterpriseName: z.string().trim().min(1),
    serialNumber: OptText,
    recruitmentBatch: OptText,
    enterpriseNature: OptText,
    industry: OptText,
    workLocation: OptText,
    graduationYear: OptText,
    degree: OptText,
    announcementLink: OptText,
    deliveryAddress: OptText,
    deadline: OptText,
    deadlineAt: DateKeySchema.nullable().optional(),
  })
  .openapi("AdminJobBody");
export const AdminJobPatchSchema = AdminJobBodySchema.partial().openapi("AdminJobPatch");
export const AdminImportResultSchema = z
  .object({
    sheets: z.array(
      z.object({ name: z.string(), created: z.number().int(), updated: z.number().int(), skipped: z.array(z.string()) }),
    ),
    usedIdKey: z.boolean(),
  })
  .openapi("AdminImportResult");
export type AdminImportResult = z.infer<typeof AdminImportResultSchema>;
```

注意 `CategoryIdSchema` 在 `AdminJobBodySchema.partial()` 里会变成 optional，没问题。`src/contract/index.ts` 已 `export *`，无需改。

- [ ] **Step 2: 写 `src/routes/admin/guard.ts`**

```ts
import { OpenAPIHono } from "@hono/zod-openapi";
import type { MiddlewareHandler } from "hono";
import type { Env } from "../../env";
import { AppError, validationHook } from "../../lib/errors";

/** requestUser 已注入 role 并拒绝了停用用户，这里只看角色 */
export const adminGuard: MiddlewareHandler<Env> = async (c, next) => {
  if (c.var.role !== "ADMIN") throw new AppError(403, "FORBIDDEN", "没有后台管理权限");
  await next();
};

export const newAdminRouter = () => new OpenAPIHono<Env>({ defaultHook: validationHook });
```

- [ ] **Step 3: 写 `src/routes/admin/summary.ts`**

```ts
import { createRoute } from "@hono/zod-openapi";
import { AdminSummarySchema } from "../../contract";
import { prisma } from "../../db";
import { newAdminRouter } from "./guard";

const getSummary = createRoute({
  method: "get",
  path: "/summary",
  tags: ["admin"],
  operationId: "getAdminSummary",
  responses: { 200: { description: "后台概览计数", content: { "application/json": { schema: AdminSummarySchema } } } },
});

export const summaryRoutes = newAdminRouter().openapi(getSummary, async (c) => {
  const now = new Date();
  const phoneUser = { identities: { some: { provider: "PHONE" as const } } };
  const [students, enabledStudents, proStudents, guests, jobs, questions, publishedQuestions, materials, courses] =
    await Promise.all([
      prisma.user.count({ where: phoneUser }),
      prisma.user.count({ where: { ...phoneUser, enabled: true } }),
      prisma.user.count({ where: { ...phoneUser, plan: "PRO", OR: [{ proExpiresAt: null }, { proExpiresAt: { gt: now } }] } }),
      prisma.user.count({ where: { identities: { none: { provider: "PHONE" } }, AND: { identities: { some: { provider: "DEVICE" } } } } }),
      prisma.job.count(),
      prisma.question.count(),
      prisma.question.count({ where: { published: true } }),
      prisma.studyMaterial.count(),
      prisma.course.count(),
    ]);
  return c.json({ students, enabledStudents, proStudents, guests, jobs, questions, publishedQuestions, materials, courses }, 200);
});
```

- [ ] **Step 4: 写 `src/routes/admin/students.ts`**

```ts
import { createRoute, z } from "@hono/zod-openapi";
import {
  AdminAccessBodySchema, AdminStudentListSchema, AdminStudentPatchSchema, adminStudentQuerySchema, ApiErrorSchema,
} from "../../contract";
import { prisma } from "../../db";
import { resolveTier } from "../../lib/access";
import { AppError, NotFoundError } from "../../lib/errors";
import { newAdminRouter } from "./guard";

const err = { "application/json": { schema: ApiErrorSchema } };

const listStudents = createRoute({
  method: "get", path: "/students", tags: ["admin"], operationId: "listAdminStudents",
  request: { query: adminStudentQuerySchema },
  responses: { 200: { description: "学生列表（有手机号的用户）", content: { "application/json": { schema: AdminStudentListSchema } } } },
});
const patchStudent = createRoute({
  method: "patch", path: "/students/{id}", tags: ["admin"], operationId: "updateAdminStudent",
  request: { params: z.object({ id: z.string() }), body: { required: true, content: { "application/json": { schema: AdminStudentPatchSchema } } } },
  responses: { 204: { description: "已更新" }, 403: { description: "不能修改管理员", content: err }, 404: { description: "不存在", content: err } },
});
const putAccess = createRoute({
  method: "put", path: "/students/{id}/access", tags: ["admin"], operationId: "replaceStudentAccess",
  request: { params: z.object({ id: z.string() }), body: { required: true, content: { "application/json": { schema: AdminAccessBodySchema } } } },
  responses: { 204: { description: "已更新" }, 400: { description: "内容不存在", content: err }, 404: { description: "不存在", content: err } },
});

/** 授权条目对应内容的标题，供后台展示 */
async function contentTitles(grants: { contentType: "MATERIAL" | "QUESTION" | "COURSE"; contentId: string }[]) {
  const ids = (t: "MATERIAL" | "QUESTION" | "COURSE") => grants.filter((g) => g.contentType === t).map((g) => g.contentId);
  const [materials, courses, questions] = await Promise.all([
    prisma.studyMaterial.findMany({ where: { id: { in: ids("MATERIAL") } }, select: { id: true, title: true } }),
    prisma.course.findMany({ where: { id: { in: ids("COURSE") } }, select: { id: true, title: true } }),
    prisma.question.findMany({ where: { id: { in: ids("QUESTION") } }, select: { id: true, prompt: true } }),
  ]);
  const map = new Map<string, string>();
  for (const m of materials) map.set(`MATERIAL:${m.id}`, m.title);
  for (const c of courses) map.set(`COURSE:${c.id}`, c.title);
  for (const q of questions) map.set(`QUESTION:${q.id}`, q.prompt.slice(0, 40));
  return map;
}

export const studentRoutes = newAdminRouter()
  .openapi(listStudents, async (c) => {
    const { q, plan, enabled, page, pageSize } = c.req.valid("query");
    const where = {
      identities: { some: { provider: "PHONE" as const } },
      ...(plan && { plan }),
      ...(enabled !== undefined && { enabled }),
      ...(q && { OR: [{ name: { contains: q } }, { identities: { some: { provider: "PHONE" as const, providerKey: { contains: q } } } }] }),
    };
    const [total, rows] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where, orderBy: [{ createdAt: "desc" }, { id: "asc" }], skip: (page - 1) * pageSize, take: pageSize,
        include: {
          identities: { where: { provider: "PHONE" }, select: { providerKey: true } },
          accessGrants: { orderBy: { createdAt: "asc" } },
          _count: { select: { favorites: true, applications: true, attempts: true } },
        },
      }),
    ]);
    const titles = await contentTitles(rows.flatMap((r) => r.accessGrants));
    const items = rows.map((u) => ({
      id: u.id, name: u.name, phone: u.identities[0]?.providerKey ?? null, role: u.role, enabled: u.enabled, plan: u.plan,
      proExpiresAt: u.proExpiresAt?.toISOString() ?? null,
      tier: resolveTier({ plan: u.plan, proExpiresAt: u.proExpiresAt, hasPhone: true }),
      createdAt: u.createdAt.toISOString(),
      stats: { favorites: u._count.favorites, applications: u._count.applications, attempts: u._count.attempts },
      grants: u.accessGrants.map((g) => ({
        id: g.id, contentType: g.contentType, contentId: g.contentId,
        contentTitle: titles.get(`${g.contentType}:${g.contentId}`) ?? null,
        expiresAt: g.expiresAt?.toISOString() ?? null,
      })),
    }));
    return c.json({ items, total, page, pageSize }, 200);
  })
  .openapi(patchStudent, async (c) => {
    const id = c.req.valid("param").id;
    const target = await prisma.user.findUnique({ where: { id }, select: { role: true } });
    if (!target) throw new NotFoundError(`学生 ${id} 不存在`);
    if (target.role === "ADMIN") throw new AppError(403, "FORBIDDEN", "不能修改管理员账号");
    const body = c.req.valid("json");
    await prisma.user.update({ where: { id }, data: { ...body, proExpiresAt: body.proExpiresAt === undefined ? undefined : body.proExpiresAt && new Date(body.proExpiresAt) } });
    return c.body(null, 204);
  })
  .openapi(putAccess, async (c) => {
    const userId = c.req.valid("param").id;
    const { grants } = c.req.valid("json");
    const target = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!target) throw new NotFoundError(`学生 ${userId} 不存在`);
    const deduped = [...new Map(grants.map((g) => [`${g.contentType}:${g.contentId}`, g])).values()];
    const titles = await contentTitles(deduped);
    for (const g of deduped) {
      if (!titles.has(`${g.contentType}:${g.contentId}`)) throw new AppError(400, "VALIDATION", `内容不存在：${g.contentType}:${g.contentId}`);
    }
    await prisma.$transaction(async (tx) => {
      await tx.accessGrant.deleteMany({ where: { userId } });
      if (deduped.length)
        await tx.accessGrant.createMany({
          data: deduped.map((g) => ({ contentType: g.contentType, contentId: g.contentId, expiresAt: g.expiresAt ? new Date(g.expiresAt) : null, userId, grantedById: c.var.userId })),
        });
    });
    return c.body(null, 204);
  });
```

`resolveTier` 的签名见 `src/lib/access.ts`；若形参名不同按实际调整。`prisma.user.update` 传 `proExpiresAt: null` 表示清空——上面的三元式：未提供 → `undefined`（不改），`null` → `null`，字符串 → `Date`。

- [ ] **Step 5: 写 `src/routes/admin/content.ts`**

从旧 `src/routes/admin.ts` 搬 `saveContent` / `deleteContent` 的实现，并加两个列表端点；`saveContent` 改为返回 `201 { id }`：

```ts
const listMaterials = createRoute({ method: "get", path: "/materials", tags: ["admin"], operationId: "listAdminMaterials",
  responses: { 200: { description: "全部资料", content: { "application/json": { schema: z.array(AdminMaterialSchema) } } } } });
const listCourses = createRoute({ method: "get", path: "/courses", tags: ["admin"], operationId: "listAdminCourses",
  responses: { 200: { description: "全部课程", content: { "application/json": { schema: z.array(AdminCourseSchema) } } } } });
const saveContent = createRoute({ method: "post", path: "/content", tags: ["admin"], operationId: "saveAdminContent",
  request: { body: { required: true, content: { "application/json": { schema: AdminContentBodySchema } } } },
  responses: { 201: { description: "已保存", content: { "application/json": { schema: IdResultSchema } } }, 404: { description: "不存在", content: err } } });
const deleteContent = createRoute({ method: "delete", path: "/content/{type}/{id}", tags: ["admin"], operationId: "deleteAdminContent",
  request: { params: z.object({ type: z.enum(["MATERIAL", "COURSE"]), id: z.string() }) },
  responses: { 204: { description: "已删除" }, 404: { description: "不存在", content: err } } });
```

列表映射：`materials.map((m) => ({ id, title, description, category, resourceUrl, published, updatedAt: m.updatedAt.toISOString() }))`（显式列字段，不要 `...m` 带出 `createdAt`）；课程同理并映射 `lessons`。`saveContent` 里 MATERIAL 分支 `const saved = b.id ? await prisma.studyMaterial.update(...) : await prisma.studyMaterial.create(...)`，返回 `c.json({ id: saved.id }, 201)`；COURSE 分支事务返回 `course.id`。

- [ ] **Step 6: 写 `src/routes/admin/index.ts`，改 `app.ts` / `content.ts`**

```ts
import { adminGuard, newAdminRouter } from "./guard";
import { contentRoutes } from "./content";
import { studentRoutes } from "./students";
import { summaryRoutes } from "./summary";

export const adminRoutes = newAdminRouter();
adminRoutes.use(adminGuard);
adminRoutes.route("/", summaryRoutes);
adminRoutes.route("/", studentRoutes);
adminRoutes.route("/", contentRoutes);
```

`src/app.ts` 里 `import { adminRoutes } from "./routes/admin"` 保持不变（目录 index 解析）。删除旧 `src/routes/admin.ts`。`src/routes/content.ts`：去掉 `prisma.user.findUniqueOrThrow` 查 role / enabled，改用 `c.var.role`（`enabled` 由 `requestUser` 保证，为真）。

- [ ] **Step 7: 重写 `src/routes/admin.test.ts`**

保留文件头的 `json()` 辅助与 `beforeEach(resetDb + seedDevUser)`。用例（每条都是独立 `it`）：

```ts
it("概览计数区分学生 / 游客 / PRO", async () => {
  await prisma.user.create({ data: { name: "游客", identities: { create: { provider: "DEVICE", providerKey: "d1" } } } });
  await prisma.user.create({ data: { name: "PRO 学生", plan: "PRO", identities: { create: { provider: "PHONE", providerKey: "13900000001" } } } });
  await prisma.user.create({ data: { name: "过期 PRO", plan: "PRO", proExpiresAt: new Date(Date.now() - 1000), identities: { create: { provider: "PHONE", providerKey: "13900000002" } } } });
  const res = await apiRequest("/api/admin/summary");
  expect(res.status).toBe(200);
  expect(await res.json()).toMatchObject({ students: 3, enabledStudents: 3, proStudents: 1, guests: 1, jobs: 0, questions: 0, materials: 0, courses: 0 });
});

it("学生列表支持搜索、分页，并带授权内容标题", async () => {
  const student = await prisma.user.create({ data: { name: "张三", identities: { create: { provider: "PHONE", providerKey: "13900000000" } } } });
  const saved = await apiRequest("/api/admin/content", json("POST", { type: "MATERIAL", title: "简历模板", url: "https://example.com/r", published: true }));
  expect(saved.status).toBe(201);
  const { id: materialId } = (await saved.json()) as { id: string };
  expect((await apiRequest(`/api/admin/students/${student.id}/access`, json("PUT", { grants: [{ contentType: "MATERIAL", contentId: materialId }] }))).status).toBe(204);
  const list = (await (await apiRequest("/api/admin/students?q=1390")).json()) as { items: { name: string; grants: { contentTitle: string | null }[] }[]; total: number };
  expect(list.total).toBe(1);
  expect(list.items[0]).toMatchObject({ name: "张三", tier: "FREE", grants: [{ contentTitle: "简历模板" }] });
  const empty = (await (await apiRequest("/api/admin/students?q=不存在")).json()) as { total: number };
  expect(empty.total).toBe(0);
});

it("授权不存在的内容返回 400；修改管理员返回 403", async () => {
  const student = await prisma.user.create({ data: { name: "学生", identities: { create: { provider: "PHONE", providerKey: "13900000000" } } } });
  const bad = await apiRequest(`/api/admin/students/${student.id}/access`, json("PUT", { grants: [{ contentType: "COURSE", contentId: "nope" }] }));
  expect(bad.status).toBe(400);
  const admin = await prisma.user.findFirstOrThrow({ where: { role: "ADMIN" } });
  expect((await apiRequest(`/api/admin/students/${admin.id}`, json("PATCH", { enabled: false }))).status).toBe(403);
  expect((await apiRequest(`/api/admin/students/${student.id}`, json("PATCH", { plan: "PRO", proExpiresAt: null, name: "李四" }))).status).toBe(204);
  const row = await prisma.user.findUniqueOrThrow({ where: { id: student.id } });
  expect(row).toMatchObject({ plan: "PRO", proExpiresAt: null, name: "李四" });
});

it("课程可创建 / 更新 / 列表 / 删除，删除后授权也被清理", async () => {
  const body = { type: "COURSE", title: "面试课", published: false, lessons: [{ title: "第一课", videoUrl: "https://example.com/1.mp4", durationMinutes: 10 }] };
  const created = await apiRequest("/api/admin/content", json("POST", body));
  expect(created.status).toBe(201);
  const { id } = (await created.json()) as { id: string };
  expect((await apiRequest("/api/admin/content", json("POST", { ...body, id, title: "面试课 2", lessons: [] }))).status).toBe(201);
  const list = (await (await apiRequest("/api/admin/courses")).json()) as { id: string; title: string; lessons: unknown[] }[];
  expect(list).toMatchObject([{ id, title: "面试课 2", lessons: [] }]);
  const student = await prisma.user.create({ data: { name: "学生", identities: { create: { provider: "PHONE", providerKey: "13900000000" } } } });
  await apiRequest(`/api/admin/students/${student.id}/access`, json("PUT", { grants: [{ contentType: "COURSE", contentId: id }] }));
  expect((await apiRequest(`/api/admin/content/COURSE/${id}`, { method: "DELETE" })).status).toBe(204);
  expect(await prisma.accessGrant.count()).toBe(0);
  expect((await apiRequest(`/api/admin/content/COURSE/${id}`, { method: "DELETE" })).status).toBe(404);
});
```

同时把旧文件里「普通学生不能访问后台，停用后不能访问业务接口」和「/api/content 只返回已授权内容」这两条用例保留（把 `/api/admin/dashboard` 换成 `/api/admin/summary`；创建资料的响应改断言 201）。

- [ ] **Step 8: 运行**

`pnpm openapi && pnpm typecheck && pnpm lint && pnpm test`。预期全绿；`openapi.json` 里不再有 `/api/admin/dashboard`，有 `/api/admin/summary`、`/students`、`/students/{id}`、`/students/{id}/access`、`/materials`、`/courses`、`/content`、`/content/{type}/{id}`。

- [ ] **Step 9: README**

在 README 加「后台管理」一节：管理员由 `ADMIN_PHONE_NUMBERS`（逗号分隔手机号）在登录时提升；`/api/admin/*` 端点清单一行一条（本任务的 8 条，Task 2 / 3 再补）；管理端仓库 `Blake-kuro/job_hunt_admin`。

- [ ] **Step 10: 提交**

`git add -A`（确认没有 `package-lock.json`）→ `git commit -m "feat(admin): 拆分 admin 路由目录；概览 / 学生分页 / 资料课程列表端点；删除 dashboard 大包" …`

---

### Task 2（后端）: 题库管理端点

**Files:**
- Create: `src/routes/admin/questions.ts`
- Modify: `src/routes/admin/index.ts`（挂载）, `src/routes/admin.test.ts`（追加用例）, `README.md`, `openapi.json`

**Interfaces:**
- Consumes: Task 1 的 `newAdminRouter`、契约 `AdminQuizMetaSchema / adminQuestionQuerySchema / AdminQuestionListSchema / AdminQuestionBodySchema / AdminQuestionPatchSchema / AdminCategoryBodySchema / AdminCategorySchema / IdResultSchema`，`quizOptionsSchema`（`src/contract/quiz.ts`）。

- [ ] **Step 1: 写 `src/routes/admin/questions.ts`**

路由定义（tags `admin`，operationId 依次 `getAdminQuizMeta`, `listAdminQuestions`, `createAdminQuestion`, `updateAdminQuestion`, `deleteAdminQuestion`, `createAdminQuestionCategory`）：

- `GET /quiz-meta`：`prisma.questionCategory.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { questions: true } } } })` → `{ id, name, questionCount: _count.questions }`；`prisma.companySet.findMany({ orderBy: [{ company: "asc" }, { track: "asc" }] })` → `{ id, company, track, focus }`。
- `GET /questions`：where = `{ ...(q && { prompt: { contains: q } }), ...(categoryId && { categoryId }), ...(published !== undefined && { published }) }`；`orderBy: { id: "asc" }`，`include: { category: { select: { name: true } } }`；映射 `options: quizOptionsSchema.parse(row.options)`, `answer: row.answer as "A"|"B"|"C"|"D"`（用 `QuizOptionLetterSchema.parse`）, `categoryName: row.category.name`。
- `POST /questions` → 201 `{ id }`；校验 `categoryId` / `companySetId` 存在（沿用旧实现的 `AppError(400, "VALIDATION", …)`）。
- `PATCH /questions/{id}`（`AdminQuestionPatchSchema`）→ 204；若 body 含 `categoryId` / `companySetId`（非 null）同样校验存在；不存在题目 → 404。
- `DELETE /questions/{id}` → 204；`$transaction`：`question.delete` + `accessGrant.deleteMany({ where: { contentType: "QUESTION", contentId: id } })`；不存在 → 404。
- `POST /question-categories` → 201 `{ id, name }`；先 `findUnique({ where: { name } })`，存在 → `AppError(400, "VALIDATION", "分类已存在")`。

抽一个 `async function assertQuestionRefs(body: { categoryId?: string; companySetId?: string | null })` 给 POST / PATCH 共用。

- [ ] **Step 2: 挂载** `adminRoutes.route("/", questionRoutes)`。

- [ ] **Step 3: 测试（追加到 `admin.test.ts`）**

```ts
it("题库：分类、分页列表、创建 / 修改 / 删除", async () => {
  const cat = await apiRequest("/api/admin/question-categories", json("POST", { name: "算法" }));
  expect(cat.status).toBe(201);
  const { id: categoryId } = (await cat.json()) as { id: string };
  expect((await apiRequest("/api/admin/question-categories", json("POST", { name: "算法" }))).status).toBe(400);
  const body = {
    prompt: "1+1=?", categoryId, options: [{ letter: "A", text: "1" }, { letter: "B", text: "2" }, { letter: "C", text: "3" }, { letter: "D", text: "4" }],
    answer: "B", explanation: ["加法"], difficulty: "EASY", source: "自编", published: false,
  };
  const created = await apiRequest("/api/admin/questions", json("POST", body));
  expect(created.status).toBe(201);
  const { id } = (await created.json()) as { id: string };
  expect((await apiRequest("/api/admin/questions", json("POST", { ...body, categoryId: "nope" }))).status).toBe(400);
  const meta = (await (await apiRequest("/api/admin/quiz-meta")).json()) as { categories: { name: string; questionCount: number }[] };
  expect(meta.categories).toMatchObject([{ name: "算法", questionCount: 1 }]);
  expect((await apiRequest(`/api/admin/questions/${id}`, json("PATCH", { published: true }))).status).toBe(204);
  const list = (await (await apiRequest("/api/admin/questions?published=true&q=1%2B1")).json()) as { total: number; items: { categoryName: string; options: unknown[] }[] };
  expect(list.total).toBe(1);
  expect(list.items[0]).toMatchObject({ categoryName: "算法", answer: "B", published: true });
  expect(list.items[0].options).toHaveLength(4);
  expect((await apiRequest(`/api/admin/questions/${id}`, { method: "DELETE" })).status).toBe(204);
  expect((await apiRequest(`/api/admin/questions/${id}`, { method: "DELETE" })).status).toBe(404);
  expect(await prisma.question.count()).toBe(0);
});
```

- [ ] **Step 4:** `pnpm openapi && pnpm typecheck && pnpm lint && pnpm test`；README 端点清单补 6 条；提交 `feat(admin): 题库管理端点（meta / 分页 / 增删改 / 分类）`。

---

### Task 3（后端）: 岗位管理端点与 Excel 导入抽取

**Files:**
- Create: `src/lib/import-jobs.ts`, `src/routes/admin/jobs.ts`
- Modify: `scripts/import-jobs.ts`（变薄）, `src/routes/admin/index.ts`, `src/routes/admin.test.ts`, `README.md`（Excel 导入一节：不再需要手动 setval；后台可上传）, `openapi.json`

**Interfaces:**
- Produces: `importWorkbook(buffer: ArrayBuffer | Buffer, todayKey?: string): Promise<AdminImportResult>`。
- Consumes: 契约 `adminJobQuerySchema / AdminJobListSchema / AdminJobBodySchema / AdminJobPatchSchema / AdminImportResultSchema / IntIdResultSchema / IdParamSchema`；`keyToDate / dbDateToKey / dateKey`（`src/lib/dates.ts`）；`mapJobRow`（`src/lib/job-row.ts`）。

- [ ] **Step 1: 抽取 `src/lib/import-jobs.ts`**

把 `scripts/import-jobs.ts` 的 `cellText`、`importSheet` 搬进来，改成不打印、返回结构：

```ts
import ExcelJS from "exceljs";
import type { AdminImportResult } from "../contract";
import { prisma } from "../db";
import { dateKey } from "./dates";
import { mapJobRow, type RawRow } from "./job-row";

export class WorkbookParseError extends Error {}

export async function importWorkbook(buffer: ArrayBuffer | Buffer, todayKey = dateKey()): Promise<AdminImportResult> {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buffer instanceof ArrayBuffer ? Buffer.from(buffer) : buffer);
  } catch (e) {
    throw new WorkbookParseError(e instanceof Error ? e.message : String(e));
  }
  let usedIdKey = false;
  const sheets: AdminImportResult["sheets"] = [];
  for (const ws of wb.worksheets) {
    const r = await importSheet(ws, todayKey);
    usedIdKey ||= r.usedIdKey;
    sheets.push(r.sheet);
  }
  if (usedIdKey) {
    await prisma.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('"Job"', 'id'), (SELECT COALESCE(MAX(id), 1) FROM "Job"))`);
  }
  return { sheets, usedIdKey };
}
```

`importSheet` 返回 `{ sheet: { name, created, updated, skipped }, usedIdKey }`，upsert 逻辑照旧。`ExcelJS.Workbook.xlsx.load` 接受 Buffer；若 `wb.worksheets` 为空也视为 `WorkbookParseError("文件里没有工作表")`。

`scripts/import-jobs.ts` 改为：读文件 `readFileSync(file)` → `importWorkbook(buffer)` → 每个 sheet 打印 `${name}：新增 x · 更新 y · 跳过 z` 与跳过明细；去掉 setval 提示。保留 `main().catch(...).finally(disconnect)`。

- [ ] **Step 2: 写 `src/routes/admin/jobs.ts`**

operationId：`listAdminJobs`, `createAdminJob`, `updateAdminJob`, `deleteAdminJob`, `importAdminJobs`。

- `GET /jobs`：where `{ ...(category && { categoryId: category }), ...(q && { OR: [{ enterpriseName: { contains: q } }, { position: { contains: q } }] }) }`；`orderBy: [{ createTime: "desc" }, { id: "desc" }]`；`include: { _count: { select: { favorites: true, applications: true } } }`；映射：`categoryId` 用 `isCategoryId` 断言（非法则当 1 并 `console.warn`，不要 500）；`deadlineAt: row.deadlineAt ? dbDateToKey(row.deadlineAt) : null`；`createTime / updateTime` `toISOString()`；`stats`。
- `POST /jobs` → 201 `{ id }`（`IntIdResultSchema`）。写入 data：把 body 的每个 `undefined` 可选字段补成 `null`（`toJobData(body)` 辅助函数：遍历 12 个可选字段），`deadlineAt: body.deadlineAt ? keyToDate(body.deadlineAt) : null`。
- `PATCH /jobs/{id}`（`IdParamSchema`，`AdminJobPatchSchema`）→ 204；只写提供的字段（`undefined` 跳过，`null` 写 null）；`deadlineAt` 同上转换；不存在 → 404。
- `DELETE /jobs/{id}` → 204；不存在 → 404。
- `POST /jobs/import`：

```ts
const importJobs = createRoute({
  method: "post", path: "/jobs/import", tags: ["admin"], operationId: "importAdminJobs",
  request: { body: { required: true, content: { "multipart/form-data": { schema: z.object({ file: z.instanceof(File).openapi({ type: "string", format: "binary" }) }) } } } },
  responses: { 200: { description: "导入结果", content: { "application/json": { schema: AdminImportResultSchema } } }, 400: { description: "文件无法解析", content: err } },
});
// handler
const { file } = c.req.valid("form");
try {
  return c.json(await importWorkbook(await file.arrayBuffer()), 200);
} catch (e) {
  if (e instanceof WorkbookParseError) throw new AppError(400, "VALIDATION", "无法解析 Excel 文件");
  throw e;
}
```

在 `jobRoutes` 上给 `/jobs/import` 加 `bodyLimit({ maxSize: 20 * 1024 * 1024 })`（`hono/body-limit`），超限 413 由 `errorHandler` 映射：在 `src/lib/errors.ts` 的 `errorHandler` 加一条 `HTTPException && status === 413` → `400 VALIDATION "文件超过 20 MB"`。若 `z.instanceof(File)` 在 Node 22 类型检查有问题，改用 `z.custom<File>((v) => v instanceof File)`。

- [ ] **Step 3: 挂载** `adminRoutes.route("/", jobRoutes)`。

- [ ] **Step 4: 测试（追加）**

```ts
it("岗位：创建 / 列表 / 修改 / 删除", async () => {
  const created = await apiRequest("/api/admin/jobs", json("POST", { categoryId: 2, enterpriseName: "国家电网", position: "电气工程师", workLocation: "杭州", deadlineAt: "2027-01-31" }));
  expect(created.status).toBe(201);
  const { id } = (await created.json()) as { id: number };
  const list = (await (await apiRequest("/api/admin/jobs?q=电网&category=2")).json()) as { total: number; items: { deadlineAt: string | null; stats: { favorites: number } }[] };
  expect(list.total).toBe(1);
  expect(list.items[0]).toMatchObject({ id, deadlineAt: "2027-01-31", industry: null, stats: { favorites: 0, applications: 0 } });
  expect((await apiRequest(`/api/admin/jobs/${id}`, json("PATCH", { deadlineAt: null, industry: "能源" }))).status).toBe(204);
  const row = await prisma.job.findUniqueOrThrow({ where: { id } });
  expect(row).toMatchObject({ deadlineAt: null, industry: "能源" });
  expect((await apiRequest(`/api/admin/jobs/${id}`, { method: "DELETE" })).status).toBe(204);
  expect((await apiRequest(`/api/admin/jobs/${id}`, { method: "DELETE" })).status).toBe(404);
});

it("岗位：上传 Excel 导入", async () => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("央国企");
  ws.addRow(["enterpriseName", "position", "workLocation", "deadline"]);
  ws.addRow(["中国移动", "网络工程师", "北京", "2027-03-01"]);
  ws.addRow(["中国电信", "产品经理", "上海", ""]);
  ws.addRow(["", "缺企业名", "", ""]);
  const buffer = Buffer.from(await wb.xlsx.writeBuffer());
  const form = new FormData();
  form.append("file", new File([buffer], "jobs.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const res = await apiRequest("/api/admin/jobs/import", { method: "POST", body: form });
  expect(res.status).toBe(200);
  expect(await res.json()).toMatchObject({ sheets: [{ name: "央国企", created: 2, updated: 0 }], usedIdKey: false });
  expect(await prisma.job.count({ where: { categoryId: 2 } })).toBe(2);
  const bad = new FormData();
  bad.append("file", new File(["not excel"], "x.xlsx"));
  expect((await apiRequest("/api/admin/jobs/import", { method: "POST", body: bad })).status).toBe(400);
});
```

`import ExcelJS from "exceljs"` 在测试文件顶部。`apiRequest` 用 `Headers` 复制 init.headers——传 FormData 时不要手动设 content-type。

- [ ] **Step 5:** `pnpm openapi && pnpm typecheck && pnpm lint && pnpm test`；手动跑一次 `pnpm db:import` 的用法提示（无参数）确认脚本还能启动；README「Excel 导入」更新（自动同步序列；后台上传）；提交 `feat(admin): 岗位管理端点；Excel 导入抽为 importWorkbook 并提供上传接口`。

---

### Task 4（管理端）: 仓库脚手架、登录、受保护布局、概览页

**Files（全部在 `/Users/black/Desktop/job_hunt_admin`，仓库与 origin 已由控制者创建，`main` 为空提交）:**
- Create: `package.json`, `pnpm-workspace.yaml`, `vite.config.ts`, `tsconfig.json`, `biome.json`, `index.html`, `.env.example`, `.gitignore`, `AGENTS.md`, `CLAUDE.md`（内容 `@AGENTS.md`）, `README.md`, `public/favicon.ico`（复制 front 的）
- Create: `src/main.tsx`, `src/router.tsx`, `src/styles/{tokens,globals}.css`, `src/shared/lib/cn.ts`, `src/shared/ui/{Button,Input,Tag,Kicker,ErrorPanel,Dialog,Field,Select,Textarea,Pagination,StatCard}.tsx`
- Create: `src/api/{client.ts,client.test.ts,types.ts,queries.ts,mutations.ts}`, `src/api/schema.d.ts`（生成）
- Create: `src/routes/{__root,login,_admin}.tsx`, `src/routes/_admin/{index,students,jobs,questions,materials,courses}.tsx`（后五个先放占位组件 `<h1>`）
- Create: `src/views/login/LoginPage.tsx`, `src/views/dashboard/DashboardPage.tsx`, `src/widgets/sidebar/Sidebar.tsx`

**Interfaces:**
- Produces（后续任务依赖）：`queries.ts` 导出 `meQuery, summaryQuery, studentsQuery, materialsQuery, coursesQuery, quizMetaQuery, questionsQuery, jobsQuery`；`mutations.ts` 导出 §3.3 全部 hook；`types.ts` 导出 `AdminStudent, AdminGrant, AdminStudentList, AdminMaterial, AdminCourse, AdminQuestion, AdminQuestionList, AdminQuizMeta, AdminJob, AdminJobList, AdminImportResult, AdminSummary, User, ContentType, AdminContentBody, AdminQuestionBody, AdminJobBody, AdminAccessBody, ApiErrorBody` 等别名（`components["schemas"][...]`）；`shared/ui` 组件 props 见下。

- [ ] **Step 1: 脚手架**

从 `/Users/black/Desktop/job_hunt_front` 复制 `package.json`（改 `name: "job-hunt-admin"`, `version: "0.1.0"`）、`vite.config.ts`（`server.port: 5174`, `preview.port: 4174`）、`tsconfig.json`、`biome.json`、`index.html`（`<title>职寻 · 管理后台</title>`，去掉 description）、`.gitignore`、`.env.example`、`public/favicon.ico`、`src/styles/*`、`src/shared/lib/cn.ts`、`src/shared/ui/{Button,Input,Tag,Kicker,ErrorPanel}.tsx`、`src/main.tsx`、`src/router.tsx`。`pnpm-workspace.yaml`：

```yaml
allowBuilds:
  esbuild: true
```

（front 用 `pnpm approve-builds` 处理过；若 `pnpm install` 提示 ignored builds，按提示 `pnpm approve-builds`。）`pnpm install`。

`AGENTS.md` 与 front 一致但改端口 5174、仓库名；再加一句「所有页面在 `_admin` 布局下，非管理员会被 `beforeLoad` 踢回 `/login`」。`CLAUDE.md` 内容 `@AGENTS.md`。`.env.local`（不提交）写 `VITE_API_PROXY=http://localhost:3001`。

- [ ] **Step 2: 生成类型、client**

`OPENAPI_SOURCE=/Users/black/Desktop/job_hunt_back/openapi.json pnpm gen:api`。`src/api/client.ts` 复制自 front，`CODES` 数组加 `"FORBIDDEN"`；`client.test.ts` 复制。`types.ts`：

```ts
import type { components, operations } from "./schema";
type S = components["schemas"];
export type User = S["User"];
export type ApiErrorBody = S["ApiError"];
export type ContentType = S["ContentType"];
export type AdminSummary = S["AdminSummary"];
export type AdminStudent = S["AdminStudent"];
export type AdminGrant = S["AdminGrant"];
export type AdminStudentList = S["AdminStudentList"];
export type AdminStudentPatch = S["AdminStudentPatch"];
export type AdminAccessBody = S["AdminAccessBody"];
export type AdminMaterial = S["AdminMaterial"];
export type AdminCourse = S["AdminCourse"];
export type AdminContentBody = S["AdminContentBody"];
export type AdminQuizMeta = S["AdminQuizMeta"];
export type AdminQuestion = S["AdminQuestion"];
export type AdminQuestionList = S["AdminQuestionList"];
export type AdminQuestionBody = S["AdminQuestionBody"];
export type AdminQuestionPatch = S["AdminQuestionPatch"];
export type AdminJob = S["AdminJob"];
export type AdminJobList = S["AdminJobList"];
export type AdminJobBody = S["AdminJobBody"];
export type AdminJobPatch = S["AdminJobPatch"];
export type AdminImportResult = S["AdminImportResult"];
export type StudentsQuery = NonNullable<operations["listAdminStudents"]["parameters"]["query"]>;
export type QuestionsQuery = NonNullable<operations["listAdminQuestions"]["parameters"]["query"]>;
export type JobsQuery = NonNullable<operations["listAdminJobs"]["parameters"]["query"]>;
```

- [ ] **Step 3: queries / mutations**

`queries.ts`：`meQuery`（同 front）；其余 `queryOptions({ queryKey: ["admin", "summary"], queryFn: () => unwrap(client.GET("/api/admin/summary")) })` 形式；带参数的 key 形如 `["admin", "students", q]`。

`mutations.ts`：每个 hook `useMutation({ mutationFn, onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "<资源>"] }) })`；`usePatchStudent`、`usePutStudentAccess` 失效 `["admin","students"]` + `["admin","summary"]`；内容类失效 `["admin","materials"]`、`["admin","courses"]`、`["admin","students"]`（授权标题）；题库类失效 `["admin","questions"]`、`["admin","quiz-meta"]`、`["admin","summary"]`；岗位类失效 `["admin","jobs"]`、`["admin","summary"]`。`useLogout`：`client.POST("/api/auth/logout")` 成功后 `qc.clear()`（跳转由调用方做）。`useImportJobs`：

```ts
mutationFn: (file: File) =>
  unwrap(client.POST("/api/admin/jobs/import", { body: { file }, bodySerializer: (b) => { const fd = new FormData(); fd.append("file", b.file); return fd; } }))
```
若 openapi-fetch 对 `file` 类型报错，把 `body` 断言为 `never` 之外的方式：`body: { file } as unknown as { file: string }`。

- [ ] **Step 4: 通用 UI**

- `Dialog.tsx`：`{ open: boolean; title: string; onClose: () => void; children; footer?: ReactNode; wide?: boolean }`。`useEffect` 里 `open ? ref.current?.showModal() : ref.current?.close()`；`onCancel` / 点击 backdrop（`e.target === ref.current`）→ `onClose`。样式：`border border-divider bg-bg p-0 shadow-lg backdrop:bg-text/40 w-[min(92vw,560px)]`（`wide` → 760px），内部 header（标题 + ✕ 按钮）、`<div class="px-6 py-5">` 内容、footer 区右对齐。
- `Field.tsx`：`{ label: string; htmlFor?: string; hint?: string; error?: string; children }` → `<label class="block"><span class="mb-1.5 block text-xs font-medium text-neutral-800">…`。
- `Select.tsx` / `Textarea.tsx`：与 `Input` 同一组 class（`min-h-10 w-full border border-divider bg-surface px-3 text-sm focus-visible:border-accent focus-visible:outline-none`）。
- `Pagination.tsx`：`{ page, pageSize, total, onChange(page) }`；`total === 0` 不渲染；显示「第 {page} / {pages} 页 · 共 {total} 条」+ 上一页 / 下一页 `Button size="sm"`。
- `StatCard.tsx`：`{ label, value: number | string, hint?, to?: string }`；`to` 存在时整卡是 `<Link>`。

- [ ] **Step 5: 路由与页面**

`__root.tsx` 同 front（notFound 链接文案「返回概览」）。

`login.tsx`：
```ts
const searchSchema = z.object({ reason: z.enum(["forbidden"]).optional() });
export const Route = createFileRoute("/login")({
  validateSearch: searchSchema,
  beforeLoad: async ({ context: { queryClient } }) => {
    const me = await queryClient.fetchQuery(meQuery());
    if (me.role === "ADMIN") throw redirect({ to: "/" });
    return { me };
  },
  component: LoginPage,
});
```
`LoginPage`：以 front 的 `LoginPage.tsx` 为底（左栏文案改「职寻 · 管理后台 / 仅限管理员登录」），`reason === "forbidden"` 或 `me.tier !== "GUEST"` 时在表单上方显示「当前账号 {me.phone} 没有管理权限」+ `Button` 「退出当前账号」（`useLogout` → `router.invalidate()`）。验证成功后：`await queryClient.invalidateQueries({ queryKey: ["auth"] })`，`navigate({ to: "/" })`（不要 `window.location.replace`）。

`_admin.tsx`：
```ts
export const Route = createFileRoute("/_admin")({
  beforeLoad: async ({ context: { queryClient } }) => {
    const me = await queryClient.fetchQuery(meQuery());
    if (me.role !== "ADMIN") throw redirect({ to: "/login", search: { reason: me.tier === "GUEST" ? undefined : "forbidden" } });
    return { me };
  },
  component: AdminLayout,
});
```
`AdminLayout`：`<div class="flex min-h-full"><Sidebar me={me} /><main class="min-w-0 flex-1 px-6 py-8 lg:px-10"><Outlet /></main></div>`。`Sidebar`：`w-60 shrink-0 border-r border-divider bg-surface` 固定；品牌；`Link` 列表 [概览 `/`, 学生 `/students`, 岗位 `/jobs`, 题库 `/questions`, 资料 `/materials`, 课程 `/courses`]，`activeProps={{ className: "bg-accent text-bg" }}`，`/` 用 `activeOptions={{ exact: true }}`；底部 `me.name / me.phone` + 「退出」按钮（`useLogout` 成功后 `navigate({ to: "/login" })`）。

`_admin/index.tsx`：`loader: ({ context: { queryClient } }) => queryClient.ensureQueryData(summaryQuery())`，`DashboardPage` 用 `useSuspenseQuery(summaryQuery())` 渲染 9 张 `StatCard`（学生→`/students`、PRO 学生→`/students?plan=PRO`、岗位→`/jobs`、题目 / 已发布→`/questions`、资料→`/materials`、课程→`/courses`；游客 / 已启用无链接）。页头 `<h1 class="text-3xl">概览</h1>`。

其余 5 个路由文件先建好带 `validateSearch`（schema 见 §3.2；`page: z.number().int().min(1).default(1)`，配合 `stripSearchParams` 去掉默认值，参考 front `routes/index.tsx` 与 `-search.ts` 的写法）和占位组件。

- [ ] **Step 6: 测试与提交**

`pnpm typecheck && pnpm lint && pnpm test`（client.test 通过）；`pnpm build` 成功。README：项目简介、启动（`.env.local`、`pnpm dev` → 5174）、`gen:api`、约定。提交（可分两次：脚手架 / 路由与页面），推送 `origin main`。

---

### Task 5（管理端）: 学生页

**Files:**
- Create: `src/views/students/StudentsPage.tsx`, `src/views/students/PlanDialog.tsx`, `src/views/students/GrantsDialog.tsx`, `src/views/students/grant-rows.ts`, `src/views/students/grant-rows.test.ts`
- Modify: `src/routes/_admin/students.tsx`（loader + component）

**Interfaces:**
- Consumes: `studentsQuery(search)`, `materialsQuery()`, `coursesQuery()`, `usePatchStudent`, `usePutStudentAccess`, `Dialog / Field / Select / Input / Pagination / Tag / Button`。

- [ ] **Step 1: `grant-rows.ts` + 测试（先写测试）**

```ts
export interface GrantRow { contentType: ContentType; contentId: string; contentTitle: string | null; expiresAt: string } // expiresAt 为 "" 或 "YYYY-MM-DD"
export function fromGrants(grants: AdminGrant[]): GrantRow[]  // expiresAt ISO → 前 10 位
export function toAccessBody(rows: GrantRow[]): AdminAccessBody   // 去掉 contentId 为空白的行；expiresAt "" → null，否则 `${d}T00:00:00.000Z`；trim contentId
```
测试 3 条：`fromGrants` 截取日期；`toAccessBody` 丢弃空行并转换日期；空数组 → `{ grants: [] }`。

- [ ] **Step 2: 页面**

`students.tsx` 路由：`loaderDeps: ({ search }) => search`，`loader: ({ context, deps }) => context.queryClient.ensureQueryData(studentsQuery(deps))`。

`StudentsPage`：顶部标题「学生」+ 工具栏：搜索 `Input`（本地 state，300 ms 防抖 → `navigate({ search: (s) => ({ ...s, q: v || undefined, page: 1 }) })`，参考 front `JobFilters` 的防抖写法）、档位 `Select`（全部 / FREE / PRO）、状态 `Select`（全部 / 启用 / 停用）。表格 `<table>`（直接写，不用 DataTable 的双布局），列：姓名·手机（两行）、角色（Tag）、档位（`tier` 为 GUEST/FREE/PRO → 游客 / 免费 / PRO，PRO 且 `proExpiresAt` 显示「到 YYYY-MM-DD」）、状态（启用 / 停用 Tag）、数据（`收藏 x · 投递 y · 作答 z`）、注册时间（`toLocaleDateString("zh-CN")`）、操作（三个 `Button size="sm"`：停用 / 启用、档位、授权（显示 `授权 (n)`）；`role === "ADMIN"` 时全部 `disabled`）。底部 `Pagination`（改 `page` 写 URL）。

`PlanDialog`：props `{ student: AdminStudent | null; onClose }`；radio FREE / PRO；PRO 时显示到期日期 `<input type="date">`（空 = 永久）；保存 → `usePatchStudent({ id, body: { plan, proExpiresAt: plan === "PRO" && date ? `${date}T00:00:00.000Z` : null } })`；错误 `role="alert"`。

`GrantsDialog`：props `{ student: AdminStudent | null; onClose }`；用 `useQuery(materialsQuery())` / `useQuery(coursesQuery())` 做下拉；行编辑器状态 `GrantRow[]`（初值 `fromGrants(student.grants)`）：每行 [类型 Select][内容：MATERIAL / COURSE → Select（标题，value = id）；QUESTION → Input 题目 id，下方小字显示 `contentTitle ?? "保存后显示题干"`][到期 date][删除]；「添加一行」默认 `{ contentType: "MATERIAL", contentId: "", contentTitle: null, expiresAt: "" }`；保存 → `usePutStudentAccess({ id, body: toAccessBody(rows) })`。

- [ ] **Step 3:** `pnpm typecheck && pnpm lint && pnpm test`；提交 `feat(students): 学生列表、档位与授权管理`。

---

### Task 6（管理端）: 岗位页

**Files:**
- Create: `src/views/jobs/JobsPage.tsx`, `src/views/jobs/JobDialog.tsx`, `src/views/jobs/ImportResultDialog.tsx`, `src/views/jobs/job-form.ts`, `src/views/jobs/job-form.test.ts`
- Modify: `src/routes/_admin/jobs.tsx`

- [ ] **Step 1: `job-form.ts` + 测试（先写测试）**

```ts
export const CATEGORY_LABEL: Record<1 | 2 | 3, string> = { 1: "秋招与实习", 2: "央国企", 3: "外企" };
export type JobFormState = { categoryId: "1" | "2" | "3"; enterpriseName: string; position: string; serialNumber: string; recruitmentBatch: string; enterpriseNature: string; industry: string; workLocation: string; graduationYear: string; degree: string; announcementLink: string; deliveryAddress: string; deadline: string; deadlineAt: string };
export const emptyJobForm: JobFormState = { categoryId: "1", …全部 "" };
export function fromJob(j: AdminJob): JobFormState   // null → ""
export function toJobBody(s: JobFormState): { ok: true; body: AdminJobBody } | { ok: false; error: string }
// 校验：enterpriseName / position trim 后非空（错误「请填写企业名称」「请填写岗位名称」）；deadlineAt 非空时必须匹配 /^\d{4}-\d{2}-\d{2}$/（「截止日期格式为 YYYY-MM-DD」）；其余空串 → null，非空 → trim
```
测试 4 条：必填校验、日期格式校验、空串转 null、`fromJob` 往返。

- [ ] **Step 2: 页面**

`jobs.tsx` 路由 loader 同 Task 5 模式（`jobsQuery(deps)`）。`JobsPage`：标题「岗位」；工具栏：搜索（防抖）、分类 `Select`（全部 / 1 / 2 / 3）、右侧「导入 Excel」（`<input type="file" accept=".xlsx" hidden>` + `Button` 触发；`onChange` → `useImportJobs.mutateAsync(file)` → 打开 `ImportResultDialog` 显示结果；失败显示 `ErrorPanel` 文案）与「新增岗位」。表格列：企业、岗位、分类、城市、批次、截止（`deadline` 文本，下行小字 `deadlineAt`）、数据（收藏 / 投递）、发布时间、操作（编辑 / 删除→`window.confirm("删除该岗位？收藏和投递记录会一并删除")` → `useDeleteJob`）。底部 `Pagination`。

`JobDialog`：props `{ mode: "create" | "edit"; job: AdminJob | null; open; onClose }`；`wide`；两列 grid 的 `Field`（分类 Select、企业、岗位、序号、批次、企业性质、行业、城市、届别、学历、公告链接、投递地址、截止说明、截止日期 date）；提交 → `toJobBody`，`ok` 为 false 显示错误；create → `useCreateJob(body)`，edit → `usePatchJob({ id, body })`。

`ImportResultDialog`：列出每个 sheet「{name}：新增 x · 更新 y · 跳过 z」+ 跳过明细 `<ul>`。

- [ ] **Step 3:** 检查三件套；提交 `feat(jobs): 岗位列表、编辑、删除与 Excel 导入`。

---

### Task 7（管理端）: 题库页

**Files:**
- Create: `src/views/questions/QuestionsPage.tsx`, `src/views/questions/QuestionDialog.tsx`, `src/views/questions/CategoryDialog.tsx`, `src/views/questions/question-form.ts`, `src/views/questions/question-form.test.ts`
- Modify: `src/routes/_admin/questions.tsx`

- [ ] **Step 1: `question-form.ts` + 测试（先写测试）**

```ts
export type QuestionFormState = { prompt: string; categoryId: string; companySetId: string; options: [string, string, string, string]; answer: "A"|"B"|"C"|"D"; explanation: string; difficulty: "EASY"|"MEDIUM"|"HARD"; source: string; published: boolean };
export const emptyQuestionForm: QuestionFormState = { prompt: "", categoryId: "", companySetId: "", options: ["", "", "", ""], answer: "A", explanation: "", difficulty: "MEDIUM", source: "", published: true };
export function fromQuestion(q: AdminQuestion): QuestionFormState   // options 按 letter A–D 取 text；explanation join("\n")；companySetId null → ""
export function toQuestionBody(s: QuestionFormState): { ok: true; body: AdminQuestionBody } | { ok: false; error: string }
// 校验顺序：prompt 非空「请填写题干」；categoryId 非空「请选择分类」；四个选项 trim 非空「四个选项都要填写」；source 非空「请填写来源」
// body.options = [{letter:"A",text},…]；explanation = 按 \n 拆分、trim、去空；companySetId "" → null
```
测试 4 条。

- [ ] **Step 2: 页面**

路由 loader：`Promise.all([ensureQueryData(questionsQuery(deps)), ensureQueryData(quizMetaQuery())])`。`QuestionsPage`：标题「题库」；工具栏：搜索、分类 Select（来自 meta，显示 `name (questionCount)`）、状态 Select（全部 / 已发布 / 未发布）、右侧「新建分类」「新增题目」。表格列：题干（截断 60 字，`title` 属性全文）、分类、难度（简单 / 中等 / 困难）、来源、状态 Tag、操作（编辑 / 发布↔下架（`usePatchQuestion({ id, body: { published: !q.published } })`）/ 删除 confirm「删除该题？作答与错题记录会一并删除」）。`Pagination`。

`QuestionDialog`：`wide`；题干 Textarea、分类 Select、公司题集 Select（「无」+ `company · track`）、A–D 四个 Input（每行前 radio 选正确答案）、解析 Textarea（hint「每行一条」）、难度 Select、来源 Input、已发布 checkbox；提交 → `toQuestionBody` → create / patch（edit 时整包 body 发 PATCH）。

`CategoryDialog`：一个 Input，提交 → `useCreateCategory`。

- [ ] **Step 3:** 检查三件套；提交 `feat(questions): 题库列表、编辑、发布与分类`。

---

### Task 8（管理端）: 资料页与课程页

**Files:**
- Create: `src/views/materials/{MaterialsPage,MaterialDialog}.tsx`, `src/views/courses/{CoursesPage,CourseDialog}.tsx`
- Modify: `src/routes/_admin/materials.tsx`, `src/routes/_admin/courses.tsx`

- [ ] **Step 1: 资料**

loader `ensureQueryData(materialsQuery())`。表格：标题（下行小字 description 截断）、分类、链接（`<a target=_blank rel=noreferrer>` 截断）、状态 Tag、更新时间、操作（编辑 / 删除 confirm「删除该资料？已授权学生将失去访问」→ `useDeleteContent({ type: "MATERIAL", id })`）。「新增资料」。`MaterialDialog`：标题、描述 Textarea、分类（默认「未分类」）、链接（必须以 http 开头，否则错误「链接需以 http:// 或 https:// 开头」）、已发布 checkbox → `useSaveContent({ type: "MATERIAL", id?, title, description: d || null, category, url, published })`。

- [ ] **Step 2: 课程**

表格：标题、课时数、状态、更新时间、操作（编辑 / 删除 confirm）。`CourseDialog`（`wide`）：标题、描述、封面 URL（可空；非空需 http 开头）、已发布；课时编辑器：行 [标题 Input][视频 URL Input][时长分钟 Input type=number]，「添加课时」，每行「↑ ↓ 删除」；提交前校验每行标题 / URL 非空（「第 n 课时缺少标题或视频链接」）；→ `useSaveContent({ type: "COURSE", id?, title, description, coverUrl: c || null, published, lessons: rows.map(({title, videoUrl, durationMinutes}) => ({ title, videoUrl, durationMinutes: durationMinutes ? Number(durationMinutes) : null })) })`。

- [ ] **Step 3:** 检查三件套 + `pnpm build`；提交 `feat(content): 资料与课程管理`；推送。

---

## 自检记录

- 覆盖：spec §2.1–2.6 → Task 1–3；§3.1–3.2 → Task 4；§3.4 五页 → Task 5–8；§3.5 测试分布在各任务；浏览器验收由控制者在最终评审后执行。
- 类型一致：`newAdminRouter / adminGuard`（T1）被 T2 / T3 使用；`AdminImportResult` 类型在契约（T1）定义、`import-jobs.ts`（T3）引用；管理端 `types.ts` 别名（T4）被 T5–8 使用；`toAccessBody / toJobBody / toQuestionBody` 返回形状与各 Dialog 的调用一致。
- 无占位：所有校验文案、错误码、端口、key 都已写明。
