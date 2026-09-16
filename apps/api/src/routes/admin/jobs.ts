import { createRoute, z } from "@hono/zod-openapi";
import { bodyLimit } from "hono/body-limit";
import {
  AdminImportResultSchema,
  AdminJobBodySchema,
  AdminJobListSchema,
  AdminJobPatchSchema,
  adminJobQuerySchema,
  type CategoryId,
  IdParamSchema,
  IntIdResultSchema,
  isCategoryId,
} from "../../contract";
import { prisma } from "../../db";
import type { Prisma } from "../../generated/prisma/client";
import { dbDateToKey, keyToDate } from "../../lib/dates";
import { AppError } from "../../lib/errors";
import { importWorkbook, WorkbookParseError } from "../../lib/import-jobs";
import { ERRORS, errorContent, jsonContent, orNotFound } from "../../lib/route";
import { newAdminRouter } from "./guard";

const MAX_IMPORT_BYTES = 20 * 1024 * 1024;

const listJobs = createRoute({
  method: "get",
  path: "/jobs",
  tags: ["admin"],
  operationId: "listAdminJobs",
  request: { query: adminJobQuerySchema },
  responses: { 200: jsonContent(AdminJobListSchema, "岗位分页列表") },
});
const createJob = createRoute({
  method: "post",
  path: "/jobs",
  tags: ["admin"],
  operationId: "createAdminJob",
  request: { body: { required: true, content: { "application/json": { schema: AdminJobBodySchema } } } },
  responses: { 201: jsonContent(IntIdResultSchema, "已创建") },
});
const updateJob = createRoute({
  method: "patch",
  path: "/jobs/{id}",
  tags: ["admin"],
  operationId: "updateAdminJob",
  request: {
    params: IdParamSchema,
    body: { required: true, content: { "application/json": { schema: AdminJobPatchSchema } } },
  },
  responses: { 204: { description: "已更新" }, 404: ERRORS.notFound },
});
const deleteJob = createRoute({
  method: "delete",
  path: "/jobs/{id}",
  tags: ["admin"],
  operationId: "deleteAdminJob",
  request: { params: IdParamSchema },
  responses: { 204: { description: "已删除" }, 404: ERRORS.notFound },
});
const importJobs = createRoute({
  method: "post",
  path: "/jobs/import",
  tags: ["admin"],
  operationId: "importAdminJobs",
  request: {
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
    200: jsonContent(AdminImportResultSchema, "导入结果"),
    400: errorContent("文件无法解析或超过 20 MB"),
  },
});

type JobBody = z.infer<typeof AdminJobBodySchema>;
type JobPatch = z.infer<typeof AdminJobPatchSchema>;

const OPTIONAL_TEXT_FIELDS = [
  "serialNumber",
  "recruitmentBatch",
  "enterpriseNature",
  "industry",
  "workLocation",
  "graduationYear",
  "degree",
  "announcementLink",
  "deliveryAddress",
  "deadline",
] as const;

type JobFields = Pick<
  Prisma.JobUncheckedCreateInput,
  "categoryId" | "position" | "enterpriseName" | "deadlineAt" | (typeof OPTIONAL_TEXT_FIELDS)[number]
>;

/** 可选文本：trim 后空串视为 null（与 job-row.ts 的 opt() 一致）；undefined 原样透传 */
function optText(v: string | null | undefined): string | null | undefined {
  if (v === undefined || v === null) return v;
  const s = v.trim();
  return s ? s : null;
}

/**
 * body → Prisma 写入字段。`undefined` 一律跳过（PATCH 不改）；`null` 写 null；
 * `fillNull` 为 true 时（POST）未提供的可选字段补成 null。
 */
function toJobData(body: JobPatch, fillNull = false): Partial<JobFields> {
  const data: Partial<JobFields> = {};
  if (body.categoryId !== undefined) data.categoryId = body.categoryId;
  if (body.position !== undefined) data.position = body.position;
  if (body.enterpriseName !== undefined) data.enterpriseName = body.enterpriseName;
  if (body.deadlineAt !== undefined) data.deadlineAt = body.deadlineAt ? keyToDate(body.deadlineAt) : null;
  else if (fillNull) data.deadlineAt = null;
  for (const key of OPTIONAL_TEXT_FIELDS) {
    const value = optText(body[key]);
    if (value !== undefined) data[key] = value;
    else if (fillNull) data[key] = null;
  }
  return data;
}

function toCategoryId(id: number, jobId: number): CategoryId {
  if (isCategoryId(id)) return id;
  console.warn(`岗位 ${jobId} 的 categoryId=${id} 非法，按 1 处理`);
  return 1;
}

const router = newAdminRouter();
router.use("/jobs/import", bodyLimit({ maxSize: MAX_IMPORT_BYTES }));

export const jobRoutes = router
  .openapi(listJobs, async (c) => {
    const { q, category, page, pageSize } = c.req.valid("query");
    const where = {
      ...(category && { categoryId: category }),
      ...(q && { OR: [{ enterpriseName: { contains: q } }, { position: { contains: q } }] }),
    };
    const [total, rows] = await Promise.all([
      prisma.job.count({ where }),
      prisma.job.findMany({
        where,
        orderBy: [{ createTime: "desc" }, { id: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { _count: { select: { favorites: true, applications: true } } },
      }),
    ]);
    const items = rows.map((row) => ({
      id: row.id,
      serialNumber: row.serialNumber,
      categoryId: toCategoryId(row.categoryId, row.id),
      recruitmentBatch: row.recruitmentBatch,
      enterpriseNature: row.enterpriseNature,
      industry: row.industry,
      workLocation: row.workLocation,
      position: row.position,
      enterpriseName: row.enterpriseName,
      graduationYear: row.graduationYear,
      degree: row.degree,
      announcementLink: row.announcementLink,
      deliveryAddress: row.deliveryAddress,
      deadline: row.deadline,
      deadlineAt: row.deadlineAt ? dbDateToKey(row.deadlineAt) : null,
      createTime: row.createTime.toISOString(),
      updateTime: row.updateTime.toISOString(),
      stats: { favorites: row._count.favorites, applications: row._count.applications },
    }));
    return c.json({ items, total, page, pageSize }, 200);
  })
  .openapi(createJob, async (c) => {
    const body: JobBody = c.req.valid("json");
    const created = await prisma.job.create({
      data: {
        ...toJobData(body, true),
        categoryId: body.categoryId,
        position: body.position,
        enterpriseName: body.enterpriseName,
      },
      select: { id: true },
    });
    return c.json({ id: created.id }, 201);
  })
  .openapi(updateJob, async (c) => {
    const { id } = c.req.valid("param");
    orNotFound(await prisma.job.findUnique({ where: { id }, select: { id: true } }), `岗位 ${id} 不存在`);
    await prisma.job.update({ where: { id }, data: toJobData(c.req.valid("json")) });
    return c.body(null, 204);
  })
  .openapi(deleteJob, async (c) => {
    const { id } = c.req.valid("param");
    orNotFound(await prisma.job.findUnique({ where: { id }, select: { id: true } }), `岗位 ${id} 不存在`);
    await prisma.job.delete({ where: { id } });
    return c.body(null, 204);
  })
  .openapi(importJobs, async (c) => {
    const { file } = c.req.valid("form");
    try {
      return c.json(await importWorkbook(await file.arrayBuffer()), 200);
    } catch (e) {
      if (e instanceof WorkbookParseError) throw new AppError(400, "VALIDATION", `无法解析 Excel 文件：${e.message}`);
      throw e;
    }
  });
