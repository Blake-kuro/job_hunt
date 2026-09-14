import { createRoute, z } from "@hono/zod-openapi";
import {
  AdminAccessBodySchema,
  AdminStudentListSchema,
  AdminStudentPatchSchema,
  ApiErrorSchema,
  adminStudentQuerySchema,
} from "../../contract";
import { prisma } from "../../db";
import { resolveTier } from "../../lib/access";
import { AppError, NotFoundError } from "../../lib/errors";
import { newAdminRouter } from "./guard";

const err = { "application/json": { schema: ApiErrorSchema } };

const listStudents = createRoute({
  method: "get",
  path: "/students",
  tags: ["admin"],
  operationId: "listAdminStudents",
  request: { query: adminStudentQuerySchema },
  responses: {
    200: {
      description: "学生列表（有手机号的用户）",
      content: { "application/json": { schema: AdminStudentListSchema } },
    },
  },
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
  responses: {
    204: { description: "已更新" },
    403: { description: "不能修改管理员", content: err },
    404: { description: "不存在", content: err },
  },
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
  responses: {
    204: { description: "已更新" },
    400: { description: "内容不存在", content: err },
    404: { description: "不存在", content: err },
  },
});

type ContentType = "MATERIAL" | "QUESTION" | "COURSE";

/** 授权条目对应内容的标题，供后台展示 */
async function contentTitles(grants: { contentType: ContentType; contentId: string }[]) {
  const ids = (t: ContentType) => grants.filter((g) => g.contentType === t).map((g) => g.contentId);
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
      ...(q && {
        OR: [
          { name: { contains: q } },
          { identities: { some: { provider: "PHONE" as const, providerKey: { contains: q } } } },
        ],
      }),
    };
    const [total, rows] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          identities: { where: { provider: "PHONE" }, select: { providerKey: true } },
          accessGrants: { orderBy: { createdAt: "asc" } },
          _count: { select: { favorites: true, applications: true, attempts: true } },
        },
      }),
    ]);
    const titles = await contentTitles(rows.flatMap((r) => r.accessGrants));
    const items = rows.map((u) => ({
      id: u.id,
      name: u.name,
      phone: u.identities[0]?.providerKey ?? null,
      role: u.role,
      enabled: u.enabled,
      plan: u.plan,
      proExpiresAt: u.proExpiresAt?.toISOString() ?? null,
      tier: resolveTier({ plan: u.plan, proExpiresAt: u.proExpiresAt, hasPhone: true }),
      createdAt: u.createdAt.toISOString(),
      stats: { favorites: u._count.favorites, applications: u._count.applications, attempts: u._count.attempts },
      grants: u.accessGrants.map((g) => ({
        id: g.id,
        contentType: g.contentType,
        contentId: g.contentId,
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
    await prisma.user.update({
      where: { id },
      data: {
        ...body,
        // 未提供 → 不改；null → 清空；字符串 → Date
        proExpiresAt: body.proExpiresAt === undefined ? undefined : body.proExpiresAt && new Date(body.proExpiresAt),
      },
    });
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
      if (!titles.has(`${g.contentType}:${g.contentId}`))
        throw new AppError(400, "VALIDATION", `内容不存在：${g.contentType}:${g.contentId}`);
    }
    await prisma.$transaction(async (tx) => {
      await tx.accessGrant.deleteMany({ where: { userId } });
      if (deduped.length)
        await tx.accessGrant.createMany({
          data: deduped.map((g) => ({
            contentType: g.contentType,
            contentId: g.contentId,
            expiresAt: g.expiresAt ? new Date(g.expiresAt) : null,
            userId,
            grantedById: c.var.userId,
          })),
        });
    });
    return c.body(null, 204);
  });
