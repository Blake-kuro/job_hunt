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
      prisma.user.count({
        where: { ...phoneUser, plan: "PRO", OR: [{ proExpiresAt: null }, { proExpiresAt: { gt: now } }] },
      }),
      prisma.user.count({
        where: { identities: { none: { provider: "PHONE" } }, AND: { identities: { some: { provider: "DEVICE" } } } },
      }),
      prisma.job.count(),
      prisma.question.count(),
      prisma.question.count({ where: { published: true } }),
      prisma.studyMaterial.count(),
      prisma.course.count(),
    ]);
  return c.json(
    { students, enabledStudents, proStudents, guests, jobs, questions, publishedQuestions, materials, courses },
    200,
  );
});
