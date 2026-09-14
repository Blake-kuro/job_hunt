import { createRoute, z } from "@hono/zod-openapi";
import {
  AdminCategoryBodySchema,
  AdminCategorySchema,
  AdminQuestionBodySchema,
  AdminQuestionListSchema,
  AdminQuestionPatchSchema,
  AdminQuizMetaSchema,
  adminQuestionQuerySchema,
  ApiErrorSchema,
  IdResultSchema,
} from "../../contract";
import { QuizOptionLetterSchema, quizOptionsSchema } from "../../contract/quiz";
import { prisma } from "../../db";
import { AppError, NotFoundError } from "../../lib/errors";
import { newAdminRouter } from "./guard";

const err = { "application/json": { schema: ApiErrorSchema } };

const getQuizMeta = createRoute({
  method: "get",
  path: "/quiz-meta",
  tags: ["admin"],
  operationId: "getAdminQuizMeta",
  responses: {
    200: { description: "题库分类与企业专项", content: { "application/json": { schema: AdminQuizMetaSchema } } },
  },
});
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
    400: { description: "分类 / 企业专项不存在", content: err },
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
    400: { description: "分类 / 企业专项不存在", content: err },
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
const createCategory = createRoute({
  method: "post",
  path: "/question-categories",
  tags: ["admin"],
  operationId: "createAdminQuestionCategory",
  request: { body: { required: true, content: { "application/json": { schema: AdminCategoryBodySchema } } } },
  responses: {
    201: { description: "已创建", content: { "application/json": { schema: AdminCategorySchema } } },
    400: { description: "分类已存在", content: err },
  },
});

/** POST / PATCH 共用：校验引用的分类 / 企业专项存在 */
async function assertQuestionRefs(body: { categoryId?: string; companySetId?: string | null }) {
  if (body.categoryId !== undefined) {
    const exists = await prisma.questionCategory.findUnique({ where: { id: body.categoryId }, select: { id: true } });
    if (!exists) throw new AppError(400, "VALIDATION", `分类 ${body.categoryId} 不存在`);
  }
  if (body.companySetId !== undefined && body.companySetId !== null) {
    const exists = await prisma.companySet.findUnique({ where: { id: body.companySetId }, select: { id: true } });
    if (!exists) throw new AppError(400, "VALIDATION", `企业专项 ${body.companySetId} 不存在`);
  }
}

export const questionRoutes = newAdminRouter()
  .openapi(getQuizMeta, async (c) => {
    const [categories, companySets] = await Promise.all([
      prisma.questionCategory.findMany({
        orderBy: { name: "asc" },
        include: { _count: { select: { questions: true } } },
      }),
      prisma.companySet.findMany({ orderBy: [{ company: "asc" }, { track: "asc" }] }),
    ]);
    return c.json(
      {
        categories: categories.map((cat) => ({ id: cat.id, name: cat.name, questionCount: cat._count.questions })),
        companySets: companySets.map((s) => ({ id: s.id, company: s.company, track: s.track, focus: s.focus })),
      },
      200,
    );
  })
  .openapi(listQuestions, async (c) => {
    const { q, categoryId, published, page, pageSize } = c.req.valid("query");
    const where = {
      ...(q && { prompt: { contains: q } }),
      ...(categoryId && { categoryId }),
      ...(published !== undefined && { published }),
    };
    const [total, rows] = await Promise.all([
      prisma.question.count({ where }),
      prisma.question.findMany({
        where,
        orderBy: { id: "asc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { category: { select: { name: true } } },
      }),
    ]);
    const items = rows.map((row) => ({
      id: row.id,
      prompt: row.prompt,
      categoryId: row.categoryId,
      categoryName: row.category.name,
      companySetId: row.companySetId,
      options: quizOptionsSchema.parse(row.options),
      answer: QuizOptionLetterSchema.parse(row.answer),
      explanation: row.explanation,
      difficulty: row.difficulty,
      source: row.source,
      published: row.published,
    }));
    return c.json({ items, total, page, pageSize }, 200);
  })
  .openapi(createQuestion, async (c) => {
    const body = c.req.valid("json");
    await assertQuestionRefs(body);
    const created = await prisma.question.create({
      data: {
        prompt: body.prompt,
        categoryId: body.categoryId,
        companySetId: body.companySetId ?? null,
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
    const exists = await prisma.question.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundError(`题目 ${id} 不存在`);
    const body = c.req.valid("json");
    await assertQuestionRefs(body);
    await prisma.question.update({ where: { id }, data: body });
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
  })
  .openapi(createCategory, async (c) => {
    const { name } = c.req.valid("json");
    const exists = await prisma.questionCategory.findUnique({ where: { name } });
    if (exists) throw new AppError(400, "VALIDATION", "分类已存在");
    const created = await prisma.questionCategory.create({ data: { name } });
    return c.json({ id: created.id, name: created.name }, 201);
  });
