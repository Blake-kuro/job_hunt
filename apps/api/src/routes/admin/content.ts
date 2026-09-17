import { createRoute, z } from "@hono/zod-openapi";
import { AdminMaterialBodySchema, AdminMaterialSchema, IdResultSchema } from "../../contract";
import { prisma } from "../../db";
import { ERRORS, jsonContent, orNotFound } from "../../lib/route";
import { newAdminRouter } from "./guard";

const listMaterials = createRoute({
  method: "get",
  path: "/materials",
  tags: ["admin"],
  operationId: "listAdminMaterials",
  responses: { 200: jsonContent(z.array(AdminMaterialSchema), "全部资料") },
});
const saveContent = createRoute({
  method: "post",
  path: "/content",
  tags: ["admin"],
  operationId: "saveAdminContent",
  request: { body: { required: true, content: { "application/json": { schema: AdminMaterialBodySchema } } } },
  responses: { 201: jsonContent(IdResultSchema, "已保存"), 400: ERRORS.badRequest, 404: ERRORS.notFound },
});
const deleteContent = createRoute({
  method: "delete",
  path: "/content/{type}/{id}",
  tags: ["admin"],
  operationId: "deleteAdminContent",
  request: { params: z.object({ type: z.enum(["MATERIAL"]), id: z.string() }) },
  responses: { 204: { description: "已删除" }, 404: ERRORS.notFound },
});

export const contentRoutes = newAdminRouter()
  .openapi(listMaterials, async (c) => {
    const materials = await prisma.studyMaterial.findMany({ orderBy: { updatedAt: "desc" } });
    return c.json(
      materials.map((m) => ({
        id: m.id,
        title: m.title,
        description: m.description,
        category: m.category,
        resourceUrl: m.resourceUrl,
        published: m.published,
        updatedAt: m.updatedAt.toISOString(),
      })),
      200,
    );
  })
  .openapi(saveContent, async (c) => {
    const b = c.req.valid("json");
    if (b.id) {
      orNotFound(
        await prisma.studyMaterial.findUnique({ where: { id: b.id }, select: { id: true } }),
        `资料 ${b.id} 不存在`,
      );
    }
    const data = {
      title: b.title,
      description: b.description ?? null,
      category: b.category ?? "未分类",
      resourceUrl: b.url,
      published: b.published,
    };
    const saved = b.id
      ? await prisma.studyMaterial.update({ where: { id: b.id }, data })
      : await prisma.studyMaterial.create({ data });
    return c.json({ id: saved.id }, 201);
  })
  .openapi(deleteContent, async (c) => {
    const { type, id } = c.req.valid("param");
    orNotFound(await prisma.studyMaterial.findUnique({ where: { id }, select: { id: true } }), `资料 ${id} 不存在`);
    await prisma.$transaction(async (tx) => {
      await tx.studyMaterial.delete({ where: { id } });
      await tx.accessGrant.deleteMany({ where: { contentType: type, contentId: id } });
    });
    return c.body(null, 204);
  });
