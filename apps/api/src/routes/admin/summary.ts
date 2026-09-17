import { createRoute } from "@hono/zod-openapi";
import { AdminSummarySchema } from "../../contract";
import { prisma } from "../../db";
import { jsonContent } from "../../lib/route";
import { newAdminRouter } from "./guard";

const getSummary = createRoute({
  method: "get",
  path: "/summary",
  tags: ["admin"],
  operationId: "getAdminSummary",
  responses: { 200: jsonContent(AdminSummarySchema, "后台概览计数") },
});

export const summaryRoutes = newAdminRouter().openapi(getSummary, async (c) => {
  const now = new Date();
  const phoneUser = { identities: { some: { provider: "PHONE" as const } } };
  const [
    students,
    enabledStudents,
    proStudents,
    guests,
    jobs,
    companies,
    questions,
    publishedQuestions,
    materials,
    courses,
    readyLessons,
    courseGrants,
  ] = await Promise.all([
    prisma.user.count({ where: phoneUser }),
    prisma.user.count({ where: { ...phoneUser, enabled: true } }),
    prisma.user.count({
      where: { ...phoneUser, plan: "PRO", OR: [{ proExpiresAt: null }, { proExpiresAt: { gt: now } }] },
    }),
    prisma.user.count({
      where: { identities: { none: { provider: "PHONE" } }, AND: { identities: { some: { provider: "DEVICE" } } } },
    }),
    prisma.job.count(),
    prisma.company.count(),
    prisma.question.count(),
    prisma.question.count({ where: { published: true } }),
    prisma.studyMaterial.count(),
    prisma.course.count(),
    prisma.courseLesson.count({ where: { videoStatus: "READY" } }),
    prisma.accessGrant.count({ where: { contentType: "COURSE" } }),
  ]);
  return c.json(
    {
      students,
      enabledStudents,
      proStudents,
      guests,
      jobs,
      companies,
      questions,
      publishedQuestions,
      materials,
      courses,
      readyLessons,
      courseGrants,
    },
    200,
  );
});
