import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { StudentContentSchema } from "../contract";
import { prisma } from "../db";
import type { Env } from "../env";
import { validationHook } from "../lib/errors";
import { jsonContent } from "../lib/route";

const listContent = createRoute({
  method: "get",
  path: "/",
  tags: ["content"],
  operationId: "listStudentContent",
  responses: { 200: jsonContent(StudentContentSchema, "已授权的资料和课程") },
});

export const contentRoutes = new OpenAPIHono<Env>({ defaultHook: validationHook }).openapi(listContent, async (c) => {
  // requestUser 已拒绝停用用户并注入 role；管理员看全部已发布内容
  const isAdmin = c.var.role === "ADMIN";
  const grants = isAdmin
    ? []
    : await prisma.accessGrant.findMany({
        where: { userId: c.var.userId, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
      });
  const ids = (type: "MATERIAL" | "COURSE") => grants.filter((g) => g.contentType === type).map((g) => g.contentId);
  const [materials, courses] = await Promise.all([
    prisma.studyMaterial.findMany({
      where: { published: true, ...(isAdmin ? {} : { id: { in: ids("MATERIAL") } }) },
      orderBy: { updatedAt: "desc" },
      select: { id: true, title: true, description: true, category: true, resourceUrl: true },
    }),
    prisma.course.findMany({
      where: { published: true, ...(isAdmin ? {} : { id: { in: ids("COURSE") } }) },
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
  ]);
  return c.json({ materials, courses }, 200);
});
