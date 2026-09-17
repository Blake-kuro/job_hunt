import { createRoute, z } from "@hono/zod-openapi";
import { AdminContentBodySchema, AdminCourseSchema, AdminMaterialSchema, IdResultSchema } from "../../contract";
import { prisma } from "../../db";
import { AppError } from "../../lib/errors";
import { ERRORS, errorContent, jsonContent, orNotFound } from "../../lib/route";
import { newAdminRouter } from "./guard";

const listMaterials = createRoute({
  method: "get",
  path: "/materials",
  tags: ["admin"],
  operationId: "listAdminMaterials",
  responses: { 200: jsonContent(z.array(AdminMaterialSchema), "全部资料") },
});
const listCourses = createRoute({
  method: "get",
  path: "/courses",
  tags: ["admin"],
  operationId: "listAdminCourses",
  responses: { 200: jsonContent(z.array(AdminCourseSchema), "全部课程") },
});
const saveContent = createRoute({
  method: "post",
  path: "/content",
  tags: ["admin"],
  operationId: "saveAdminContent",
  request: { body: { required: true, content: { "application/json": { schema: AdminContentBodySchema } } } },
  responses: {
    201: jsonContent(IdResultSchema, "已保存"),
    400: errorContent("课程已迁移到网课，不能用旧接口重写"),
    404: ERRORS.notFound,
  },
});
const deleteContent = createRoute({
  method: "delete",
  path: "/content/{type}/{id}",
  tags: ["admin"],
  operationId: "deleteAdminContent",
  request: { params: z.object({ type: z.enum(["MATERIAL", "COURSE"]), id: z.string() }) },
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
  .openapi(listCourses, async (c) => {
    const courses = await prisma.course.findMany({
      orderBy: { updatedAt: "desc" },
      include: { lessons: { orderBy: { sortOrder: "asc" } } },
    });
    return c.json(
      courses.map((course) => ({
        id: course.id,
        title: course.title,
        description: course.description,
        coverUrl: course.coverUrl,
        published: course.published,
        updatedAt: course.updatedAt.toISOString(),
        // 过渡期（Task 2 重做管理端课程接口前）：旧外链 / 分钟时长由新列换算
        lessons: course.lessons.map((l) => ({
          id: l.id,
          title: l.title,
          videoUrl: l.legacyVideoUrl ?? "",
          durationMinutes: l.durationSeconds === null ? null : Math.round(l.durationSeconds / 60),
          sortOrder: l.sortOrder,
        })),
      })),
      200,
    );
  })
  .openapi(saveContent, async (c) => {
    const b = c.req.valid("json");
    if (b.type === "MATERIAL") {
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
    }
    if (b.id) {
      const course = orNotFound(
        await prisma.course.findUnique({
          where: { id: b.id },
          select: {
            id: true,
            _count: { select: { progresses: true, lessons: { where: { videoFileId: { not: null } } } } },
          },
        }),
        `课程 ${b.id} 不存在`,
      );
      // 过渡期：旧接口整表重写课时会级联删掉 VOD 课时与学生进度，已迁移到网课的课程一律拒绝
      if (course._count.lessons > 0 || course._count.progresses > 0)
        throw new AppError(400, "VALIDATION", "该课程已迁移到网课，请在课程页编辑");
    }
    const data = {
      title: b.title,
      description: b.description ?? null,
      coverUrl: b.coverUrl ?? null,
      published: b.published,
    };
    const id = await prisma.$transaction(async (tx) => {
      const course = b.id ? await tx.course.update({ where: { id: b.id }, data }) : await tx.course.create({ data });
      await tx.courseLesson.deleteMany({ where: { courseId: course.id } });
      await tx.courseLesson.createMany({
        data: b.lessons.map((l, i) => ({
          title: l.title,
          legacyVideoUrl: l.videoUrl,
          durationSeconds: l.durationMinutes == null ? null : l.durationMinutes * 60,
          courseId: course.id,
          sortOrder: i,
        })),
      });
      return course.id;
    });
    return c.json({ id }, 201);
  })
  .openapi(deleteContent, async (c) => {
    const { type, id } = c.req.valid("param");
    if (type === "MATERIAL") {
      orNotFound(await prisma.studyMaterial.findUnique({ where: { id }, select: { id: true } }), `资料 ${id} 不存在`);
    } else {
      orNotFound(await prisma.course.findUnique({ where: { id }, select: { id: true } }), `课程 ${id} 不存在`);
    }
    await prisma.$transaction(async (tx) => {
      if (type === "MATERIAL") await tx.studyMaterial.delete({ where: { id } });
      else await tx.course.delete({ where: { id } });
      await tx.accessGrant.deleteMany({ where: { contentType: type, contentId: id } });
    });
    return c.body(null, 204);
  });
