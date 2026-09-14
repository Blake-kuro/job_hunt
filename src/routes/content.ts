import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { StudentContentSchema } from "../contract";
import { prisma } from "../db";
import type { Env } from "../env";
import { validationHook } from "../lib/errors";

const listContent = createRoute({
  method: "get",
  path: "/",
  tags: ["content"],
  operationId: "listStudentContent",
  responses: {
    200: { description: "已授权的资料和课程", content: { "application/json": { schema: StudentContentSchema } } },
  },
});

export const contentRoutes = new OpenAPIHono<Env>({ defaultHook: validationHook }).openapi(listContent, async (c) => {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: c.var.userId },
    select: { role: true, enabled: true },
  });
  const grants =
    user.role === "ADMIN"
      ? []
      : await prisma.accessGrant.findMany({
          where: { userId: c.var.userId, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
        });
  const ids = (type: "MATERIAL" | "COURSE") => grants.filter((g) => g.contentType === type).map((g) => g.contentId);
  const [materials, courses] = user.enabled
    ? await Promise.all([
        prisma.studyMaterial.findMany({
          where: { published: true, ...(user.role === "ADMIN" ? {} : { id: { in: ids("MATERIAL") } }) },
          orderBy: { updatedAt: "desc" },
          select: { id: true, title: true, description: true, category: true, resourceUrl: true },
        }),
        prisma.course.findMany({
          where: { published: true, ...(user.role === "ADMIN" ? {} : { id: { in: ids("COURSE") } }) },
          orderBy: { updatedAt: "desc" },
          select: {
            id: true,
            title: true,
            description: true,
            coverUrl: true,
            lessons: {
              orderBy: { sortOrder: "asc" },
              select: { id: true, title: true, videoUrl: true, durationMinutes: true, sortOrder: true },
            },
          },
        }),
      ])
    : [[], []];
  return c.json({ materials, courses }, 200);
});
