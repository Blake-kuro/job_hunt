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
  responses: { 200: jsonContent(StudentContentSchema, "已授权的资料（网课见 /courses）") },
});

export const contentRoutes = new OpenAPIHono<Env>({ defaultHook: validationHook }).openapi(listContent, async (c) => {
  // requestUser 已拒绝停用用户并注入 role；管理员看全部已发布资料
  const isAdmin = c.var.role === "ADMIN";
  const grants = isAdmin
    ? []
    : await prisma.accessGrant.findMany({
        where: {
          userId: c.var.userId,
          contentType: "MATERIAL",
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        select: { contentId: true },
      });
  const materials = await prisma.studyMaterial.findMany({
    where: { published: true, ...(isAdmin ? {} : { id: { in: grants.map((g) => g.contentId) } }) },
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true, description: true, category: true, resourceUrl: true },
  });
  return c.json({ materials }, 200);
});
