import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { z } from "@hono/zod-openapi";
import {
  AdminAccessBodySchema,
  AdminContentBodySchema,
  AdminDashboardSchema,
  AdminQuestionBodySchema,
  AdminStudentPatchSchema,
} from "../contract";
import { prisma } from "../db";
import type { Env } from "../env";
import { AppError, NotFoundError, validationHook } from "../lib/errors";

async function assertAdmin(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, enabled: true } });
  if (!user?.enabled || user.role !== "ADMIN") throw new AppError(403, "FORBIDDEN", "没有后台管理权限");
}

async function dashboard() {
  const [users, materials, courses, questions, categories] = await Promise.all([
    prisma.user.findMany({
      where: { identities: { some: { provider: "PHONE" } } },
      orderBy: { createdAt: "desc" },
      include: { identities: { where: { provider: "PHONE" } }, accessGrants: true },
    }),
    prisma.studyMaterial.findMany({ orderBy: { updatedAt: "desc" } }),
    prisma.course.findMany({ orderBy: { updatedAt: "desc" }, include: { lessons: { orderBy: { sortOrder: "asc" } } } }),
    prisma.question.findMany({
      orderBy: { id: "asc" },
      select: {
        id: true,
        prompt: true,
        categoryId: true,
        options: true,
        answer: true,
        explanation: true,
        difficulty: true,
        source: true,
        published: true,
      },
    }),
    prisma.questionCategory.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const students = users.map((u) => ({
    id: u.id,
    name: u.name,
    phone: u.identities[0]?.providerKey ?? null,
    enabled: u.enabled,
    plan: u.plan,
    proExpiresAt: u.proExpiresAt?.toISOString() ?? null,
    createdAt: u.createdAt.toISOString(),
    grants: u.accessGrants.map((g) => ({
      id: g.id,
      contentType: g.contentType,
      contentId: g.contentId,
      expiresAt: g.expiresAt?.toISOString() ?? null,
    })),
  }));
  return {
    summary: {
      students: students.length,
      enabledStudents: students.filter((s) => s.enabled).length,
      materials: materials.length,
      courses: courses.length,
      questions: questions.length,
    },
    students,
    materials: materials.map((m) => ({ ...m, updatedAt: m.updatedAt.toISOString(), createdAt: undefined })),
    courses: courses.map((c) => ({ ...c, updatedAt: c.updatedAt.toISOString(), createdAt: undefined })),
    questions,
    categories,
  };
}

const getDashboard = createRoute({
  method: "get",
  path: "/dashboard",
  tags: ["admin"],
  operationId: "getAdminDashboard",
  responses: { 200: { description: "后台数据", content: { "application/json": { schema: AdminDashboardSchema } } } },
});
const patchStudent = createRoute({
  method: "patch",
  path: "/students/{id}",
  tags: ["admin"],
  operationId: "updateAdminStudent",
  request: {
    params: z.object({ id: z.string() }),
    body: { required: true, content: { "application/json": { schema: AdminStudentPatchSchema } } },
  },
  responses: { 204: { description: "已更新" } },
});
const putAccess = createRoute({
  method: "put",
  path: "/students/{id}/access",
  tags: ["admin"],
  operationId: "replaceStudentAccess",
  request: {
    params: z.object({ id: z.string() }),
    body: { required: true, content: { "application/json": { schema: AdminAccessBodySchema } } },
  },
  responses: { 204: { description: "已更新" } },
});
const saveContent = createRoute({
  method: "post",
  path: "/content",
  tags: ["admin"],
  operationId: "saveAdminContent",
  request: { body: { required: true, content: { "application/json": { schema: AdminContentBodySchema } } } },
  responses: { 204: { description: "已保存" } },
});
const deleteContent = createRoute({
  method: "delete",
  path: "/content/{type}/{id}",
  tags: ["admin"],
  operationId: "deleteAdminContent",
  request: { params: z.object({ type: z.enum(["MATERIAL", "COURSE"]), id: z.string() }) },
  responses: { 204: { description: "已删除" } },
});
const createQuestion = createRoute({
  method: "post",
  path: "/questions",
  tags: ["admin"],
  operationId: "createAdminQuestion",
  request: { body: { required: true, content: { "application/json": { schema: AdminQuestionBodySchema } } } },
  responses: { 204: { description: "已创建" } },
});
const patchQuestion = createRoute({
  method: "patch",
  path: "/questions/{id}",
  tags: ["admin"],
  operationId: "updateAdminQuestion",
  request: {
    params: z.object({ id: z.string() }),
    body: { required: true, content: { "application/json": { schema: AdminQuestionBodySchema.partial() } } },
  },
  responses: { 204: { description: "已更新" } },
});

export const adminRoutes = new OpenAPIHono<Env>({ defaultHook: validationHook });
adminRoutes.use(async (c, next) => {
  await assertAdmin(c.var.userId);
  await next();
});
adminRoutes
  .openapi(getDashboard, async (c) => c.json(await dashboard(), 200))
  .openapi(patchStudent, async (c) => {
    const id = c.req.valid("param").id;
    const target = await prisma.user.findUnique({ where: { id }, select: { role: true } });
    if (!target) throw new NotFoundError(`学生 ${id} 不存在`);
    if (target.role === "ADMIN") throw new AppError(403, "FORBIDDEN", "不能修改管理员账号");
    await prisma.user.update({ where: { id }, data: c.req.valid("json") });
    return c.body(null, 204);
  })
  .openapi(putAccess, async (c) => {
    const userId = c.req.valid("param").id;
    const { grants } = c.req.valid("json");
    const deduped = [...new Map(grants.map((g) => [`${g.contentType}:${g.contentId}`, g])).values()];
    await prisma.$transaction(async (tx) => {
      await tx.accessGrant.deleteMany({ where: { userId } });
      if (deduped.length)
        await tx.accessGrant.createMany({
          data: deduped.map((g) => ({
            ...g,
            expiresAt: g.expiresAt ? new Date(g.expiresAt) : null,
            userId,
            grantedById: c.var.userId,
          })),
        });
    });
    return c.body(null, 204);
  })
  .openapi(saveContent, async (c) => {
    const b = c.req.valid("json");
    if (b.type === "MATERIAL") {
      if (b.id) {
        const exists = await prisma.studyMaterial.findUnique({ where: { id: b.id }, select: { id: true } });
        if (!exists) throw new NotFoundError(`资料 ${b.id} 不存在`);
      }
      const data = {
        title: b.title,
        description: b.description ?? null,
        category: b.category ?? "未分类",
        resourceUrl: b.url,
        published: b.published,
      };
      b.id
        ? await prisma.studyMaterial.update({ where: { id: b.id }, data })
        : await prisma.studyMaterial.create({ data });
    } else {
      if (b.id) {
        const exists = await prisma.course.findUnique({ where: { id: b.id }, select: { id: true } });
        if (!exists) throw new NotFoundError(`课程 ${b.id} 不存在`);
      }
      const data = {
        title: b.title,
        description: b.description ?? null,
        coverUrl: b.coverUrl ?? null,
        published: b.published,
      };
      await prisma.$transaction(async (tx) => {
        const course = b.id ? await tx.course.update({ where: { id: b.id }, data }) : await tx.course.create({ data });
        await tx.courseLesson.deleteMany({ where: { courseId: course.id } });
        await tx.courseLesson.createMany({
          data: b.lessons.map((l, i) => ({
            ...l,
            durationMinutes: l.durationMinutes ?? null,
            courseId: course.id,
            sortOrder: i,
          })),
        });
      });
    }
    return c.body(null, 204);
  })
  .openapi(deleteContent, async (c) => {
    const { type, id } = c.req.valid("param");
    if (type === "MATERIAL") {
      const exists = await prisma.studyMaterial.findUnique({ where: { id }, select: { id: true } });
      if (!exists) throw new NotFoundError(`资料 ${id} 不存在`);
    } else {
      const exists = await prisma.course.findUnique({ where: { id }, select: { id: true } });
      if (!exists) throw new NotFoundError(`课程 ${id} 不存在`);
    }
    await prisma.$transaction(async (tx) => {
      if (type === "MATERIAL") await tx.studyMaterial.delete({ where: { id } });
      else await tx.course.delete({ where: { id } });
      await tx.accessGrant.deleteMany({ where: { contentType: type, contentId: id } });
    });
    return c.body(null, 204);
  })
  .openapi(createQuestion, async (c) => {
    const body = c.req.valid("json");
    const category = await prisma.questionCategory.findUnique({
      where: { id: body.categoryId },
      select: { id: true },
    });
    if (!category) throw new AppError(400, "VALIDATION", `题库分类 ${body.categoryId} 不存在`);
    if (body.companySetId) {
      const set = await prisma.companySet.findUnique({ where: { id: body.companySetId }, select: { id: true } });
      if (!set) throw new AppError(400, "VALIDATION", `公司题集 ${body.companySetId} 不存在`);
    }
    await prisma.question.create({ data: { ...body, companySetId: body.companySetId ?? null } });
    return c.body(null, 204);
  })
  .openapi(patchQuestion, async (c) => {
    const id = c.req.valid("param").id;
    const exists = await prisma.question.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundError(`题目 ${id} 不存在`);
    await prisma.question.update({ where: { id }, data: c.req.valid("json") });
    return c.body(null, 204);
  });
