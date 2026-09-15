import { createRoute, z } from "@hono/zod-openapi";
import {
  AdminQuestionBodySchema,
  AdminQuestionListSchema,
  AdminQuestionPatchSchema,
  adminQuestionQuerySchema,
  ApiErrorSchema,
  IdResultSchema,
} from "../../contract";
import { quizOptionsSchema } from "../../contract/quiz";
import { prisma } from "../../db";
import { AppError, NotFoundError } from "../../lib/errors";
import { validateQuestionShape } from "../../lib/grade";
import { newAdminRouter } from "./guard";

const err = { "application/json": { schema: ApiErrorSchema } };

const listQuestions = createRoute({
  method: "get",
  path: "/questions",
  tags: ["admin"],
  operationId: "listAdminQuestions",
  request: { query: adminQuestionQuerySchema },
  responses: {
    200: { description: "题目分页列表", content: { "application/json": { schema: AdminQuestionListSchema } } },
  },
});
const createQuestion = createRoute({
  method: "post",
  path: "/questions",
  tags: ["admin"],
  operationId: "createAdminQuestion",
  request: { body: { required: true, content: { "application/json": { schema: AdminQuestionBodySchema } } } },
  responses: {
    201: { description: "已创建", content: { "application/json": { schema: IdResultSchema } } },
    400: { description: "分类不存在或题目形状不合法", content: err },
  },
});
const updateQuestion = createRoute({
  method: "patch",
  path: "/questions/{id}",
  tags: ["admin"],
  operationId: "updateAdminQuestion",
  request: {
    params: z.object({ id: z.string() }),
    body: { required: true, content: { "application/json": { schema: AdminQuestionPatchSchema } } },
  },
  responses: {
    204: { description: "已更新" },
    400: { description: "分类不存在或题目形状不合法", content: err },
    404: { description: "不存在", content: err },
  },
});
const deleteQuestion = createRoute({
  method: "delete",
  path: "/questions/{id}",
  tags: ["admin"],
  operationId: "deleteAdminQuestion",
  request: { params: z.object({ id: z.string() }) },
  responses: { 204: { description: "已删除" }, 404: { description: "不存在", content: err } },
});

/** POST / PATCH 共用：校验引用的分类存在 */
async function assertCategoryExists(categoryId: string | undefined) {
  if (categoryId === undefined) return;
  const exists = await prisma.questionCategory.findUnique({ where: { id: categoryId }, select: { id: true } });
  if (!exists) throw new AppError(400, "VALIDATION", `分类 ${categoryId} 不存在`);
}

/** 题型 / 选项 / 答案组合不合法 → 400 */
function assertShape(shape: { type: "SINGLE" | "MULTI" | "JUDGE"; options: unknown; answer: string }) {
  const msg = validateQuestionShape(shape.type, quizOptionsSchema.parse(shape.options), shape.answer);
  if (msg) throw new AppError(400, "VALIDATION", msg);
}

export const questionRoutes = newAdminRouter()
  .openapi(listQuestions, async (c) => {
    const { q, companyId, categoryId, type, section, published, page, pageSize } = c.req.valid("query");
    const where = {
      ...(q && { prompt: { contains: q } }),
      ...(companyId && { category: { companyId } }),
      ...(categoryId && { categoryId }),
      ...(type && { type }),
      ...(section && { section }),
      ...(published !== undefined && { published }),
    };
    const [total, rows] = await Promise.all([
      prisma.question.count({ where }),
      prisma.question.findMany({
        where,
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { category: { select: { name: true, company: { select: { id: true, name: true } } } } },
      }),
    ]);
    const items = rows.map((row) => ({
      id: row.id,
      companyId: row.category.company.id,
      companyName: row.category.company.name,
      categoryId: row.categoryId,
      categoryName: row.category.name,
      type: row.type,
      section: row.section,
      sortOrder: row.sortOrder,
      prompt: row.prompt,
      options: quizOptionsSchema.parse(row.options),
      answer: row.answer,
      explanation: row.explanation,
      difficulty: row.difficulty,
      source: row.source,
      published: row.published,
    }));
    return c.json({ items, total, page, pageSize }, 200);
  })
  .openapi(createQuestion, async (c) => {
    const body = c.req.valid("json");
    await assertCategoryExists(body.categoryId);
    assertShape(body);
    const created = await prisma.question.create({
      data: {
        categoryId: body.categoryId,
        type: body.type,
        section: body.section?.trim() || null,
        sortOrder: body.sortOrder ?? 0,
        prompt: body.prompt,
        options: body.options,
        answer: body.answer,
        explanation: body.explanation,
        difficulty: body.difficulty,
        source: body.source,
        published: body.published,
      },
    });
    return c.json({ id: created.id }, 201);
  })
  .openapi(updateQuestion, async (c) => {
    const id = c.req.valid("param").id;
    const current = await prisma.question.findUnique({
      where: { id },
      select: { type: true, options: true, answer: true },
    });
    if (!current) throw new NotFoundError(`题目 ${id} 不存在`);
    const body = c.req.valid("json");
    await assertCategoryExists(body.categoryId);
    if (body.type !== undefined || body.options !== undefined || body.answer !== undefined) {
      assertShape({ ...current, ...body });
    }
    const { section, ...rest } = body;
    await prisma.question.update({
      where: { id },
      data: { ...rest, ...(section !== undefined && { section: section?.trim() || null }) },
    });
    return c.body(null, 204);
  })
  .openapi(deleteQuestion, async (c) => {
    const id = c.req.valid("param").id;
    const exists = await prisma.question.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundError(`题目 ${id} 不存在`);
    await prisma.$transaction(async (tx) => {
      await tx.question.delete({ where: { id } });
      await tx.accessGrant.deleteMany({ where: { contentType: "QUESTION", contentId: id } });
    });
    return c.body(null, 204);
  });
