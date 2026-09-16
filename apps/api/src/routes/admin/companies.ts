import { createRoute, z } from "@hono/zod-openapi";
import { bodyLimit } from "hono/body-limit";
import {
  AdminCategoryBodySchema,
  AdminCategoryPatchSchema,
  AdminCategorySchema,
  AdminCompanyBodySchema,
  AdminCompanyPatchSchema,
  AdminCompanySchema,
  AdminQuestionImportResultSchema,
  AdminQuizMetaSchema,
  ApiErrorSchema,
} from "../../contract";
import { prisma } from "../../db";
import { AppError, isUniqueViolation, NotFoundError } from "../../lib/errors";
import { WorkbookParseError } from "../../lib/excel";
import { importQuestionWorkbook } from "../../lib/import-questions";
import { newAdminRouter } from "./guard";

const err = { "application/json": { schema: ApiErrorSchema } };
const ORDER = [{ sortOrder: "asc" }, { name: "asc" }] as const;
const MAX_IMPORT_BYTES = 20 * 1024 * 1024;
const IdParam = z.object({ id: z.string() });

const getQuizMeta = createRoute({
  method: "get",
  path: "/quiz-meta",
  tags: ["admin"],
  operationId: "getAdminQuizMeta",
  responses: {
    200: { description: "公司 → 分类树（含题量）", content: { "application/json": { schema: AdminQuizMetaSchema } } },
  },
});
const createCompany = createRoute({
  method: "post",
  path: "/companies",
  tags: ["admin"],
  operationId: "createAdminCompany",
  request: { body: { required: true, content: { "application/json": { schema: AdminCompanyBodySchema } } } },
  responses: {
    201: { description: "已创建", content: { "application/json": { schema: AdminCompanySchema } } },
    400: { description: "公司已存在", content: err },
  },
});
const updateCompany = createRoute({
  method: "patch",
  path: "/companies/{id}",
  tags: ["admin"],
  operationId: "updateAdminCompany",
  request: {
    params: IdParam,
    body: { required: true, content: { "application/json": { schema: AdminCompanyPatchSchema } } },
  },
  responses: {
    204: { description: "已更新" },
    400: { description: "公司已存在", content: err },
    404: { description: "不存在", content: err },
  },
});
const deleteCompany = createRoute({
  method: "delete",
  path: "/companies/{id}",
  tags: ["admin"],
  operationId: "deleteAdminCompany",
  request: { params: IdParam },
  responses: { 204: { description: "已删除（级联分类与题目）" }, 404: { description: "不存在", content: err } },
});
const createCategory = createRoute({
  method: "post",
  path: "/question-categories",
  tags: ["admin"],
  operationId: "createAdminQuestionCategory",
  request: { body: { required: true, content: { "application/json": { schema: AdminCategoryBodySchema } } } },
  responses: {
    201: { description: "已创建", content: { "application/json": { schema: AdminCategorySchema } } },
    400: { description: "公司不存在或同公司下分类已存在", content: err },
  },
});
const updateCategory = createRoute({
  method: "patch",
  path: "/question-categories/{id}",
  tags: ["admin"],
  operationId: "updateAdminQuestionCategory",
  request: {
    params: IdParam,
    body: { required: true, content: { "application/json": { schema: AdminCategoryPatchSchema } } },
  },
  responses: {
    204: { description: "已更新" },
    400: { description: "同公司下分类已存在", content: err },
    404: { description: "不存在", content: err },
  },
});
const deleteCategory = createRoute({
  method: "delete",
  path: "/question-categories/{id}",
  tags: ["admin"],
  operationId: "deleteAdminQuestionCategory",
  request: { params: IdParam },
  responses: { 204: { description: "已删除（级联题目）" }, 404: { description: "不存在", content: err } },
});
const importQuestions = createRoute({
  method: "post",
  path: "/question-categories/{id}/import",
  tags: ["admin"],
  operationId: "importAdminQuestions",
  request: {
    params: IdParam,
    body: {
      required: true,
      content: {
        "multipart/form-data": {
          schema: z.object({
            file: z
              .custom<File>((v) => v instanceof File, "需要上传文件")
              .openapi({ type: "string", format: "binary" }),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "导入结果（新增数与跳过明细）",
      content: { "application/json": { schema: AdminQuestionImportResultSchema } },
    },
    400: { description: "文件无法解析或超过 20 MB", content: err },
    404: { description: "分类不存在", content: err },
  },
});

async function assertCompanyNameFree(name: string, exceptId?: string) {
  const dup = await prisma.company.findUnique({ where: { name }, select: { id: true } });
  if (dup && dup.id !== exceptId) throw new AppError(400, "VALIDATION", "公司已存在");
}

async function assertCategoryNameFree(companyId: string, name: string, exceptId?: string) {
  const dup = await prisma.questionCategory.findUnique({
    where: { companyId_name: { companyId, name } },
    select: { id: true },
  });
  if (dup && dup.id !== exceptId) throw new AppError(400, "VALIDATION", "分类已存在");
}

/** 重名检查之后再兜一层唯一约束冲突（并发时 check-then-write 会撞 P2002） */
async function orConflict<T>(write: Promise<T>, message: string): Promise<T> {
  try {
    return await write;
  } catch (e) {
    if (isUniqueViolation(e)) throw new AppError(400, "VALIDATION", message);
    throw e;
  }
}

const router = newAdminRouter();
router.use("/question-categories/:id/import", bodyLimit({ maxSize: MAX_IMPORT_BYTES }));

export const companyRoutes = router
  .openapi(getQuizMeta, async (c) => {
    const companies = await prisma.company.findMany({
      orderBy: [...ORDER],
      include: {
        categories: {
          orderBy: [...ORDER],
          include: { _count: { select: { questions: true } } },
        },
      },
    });
    const publishedByCategory = await prisma.question.groupBy({
      by: ["categoryId"],
      where: { published: true },
      _count: { _all: true },
    });
    const published = new Map(publishedByCategory.map((r) => [r.categoryId, r._count._all]));
    return c.json(
      {
        companies: companies.map((co) => ({
          id: co.id,
          name: co.name,
          sortOrder: co.sortOrder,
          categories: co.categories.map((cat) => ({
            id: cat.id,
            name: cat.name,
            sortOrder: cat.sortOrder,
            questionCount: cat._count.questions,
            publishedCount: published.get(cat.id) ?? 0,
          })),
        })),
      },
      200,
    );
  })
  .openapi(createCompany, async (c) => {
    const { name } = c.req.valid("json");
    await assertCompanyNameFree(name);
    const created = await orConflict(prisma.company.create({ data: { name } }), "公司已存在");
    return c.json({ id: created.id, name: created.name, sortOrder: created.sortOrder }, 201);
  })
  .openapi(updateCompany, async (c) => {
    const { id } = c.req.valid("param");
    const exists = await prisma.company.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundError(`公司 ${id} 不存在`);
    const body = c.req.valid("json");
    if (body.name !== undefined) await assertCompanyNameFree(body.name, id);
    await orConflict(prisma.company.update({ where: { id }, data: body }), "公司已存在");
    return c.body(null, 204);
  })
  .openapi(deleteCompany, async (c) => {
    const { id } = c.req.valid("param");
    const exists = await prisma.company.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundError(`公司 ${id} 不存在`);
    await prisma.company.delete({ where: { id } });
    return c.body(null, 204);
  })
  .openapi(createCategory, async (c) => {
    const { companyId, name } = c.req.valid("json");
    const company = await prisma.company.findUnique({ where: { id: companyId }, select: { id: true } });
    if (!company) throw new AppError(400, "VALIDATION", `公司 ${companyId} 不存在`);
    await assertCategoryNameFree(companyId, name);
    const created = await orConflict(prisma.questionCategory.create({ data: { companyId, name } }), "分类已存在");
    return c.json(
      { id: created.id, companyId: created.companyId, name: created.name, sortOrder: created.sortOrder },
      201,
    );
  })
  .openapi(updateCategory, async (c) => {
    const { id } = c.req.valid("param");
    const current = await prisma.questionCategory.findUnique({ where: { id }, select: { companyId: true } });
    if (!current) throw new NotFoundError(`分类 ${id} 不存在`);
    const body = c.req.valid("json");
    if (body.name !== undefined) await assertCategoryNameFree(current.companyId, body.name, id);
    await orConflict(prisma.questionCategory.update({ where: { id }, data: body }), "分类已存在");
    return c.body(null, 204);
  })
  .openapi(deleteCategory, async (c) => {
    const { id } = c.req.valid("param");
    const exists = await prisma.questionCategory.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundError(`分类 ${id} 不存在`);
    await prisma.questionCategory.delete({ where: { id } });
    return c.body(null, 204);
  })
  .openapi(importQuestions, async (c) => {
    const { id } = c.req.valid("param");
    const { file } = c.req.valid("form");
    try {
      return c.json(await importQuestionWorkbook(id, await file.arrayBuffer()), 200);
    } catch (e) {
      if (e instanceof WorkbookParseError) throw new AppError(400, "VALIDATION", `无法解析 Excel 文件：${e.message}`);
      throw e;
    }
  });
