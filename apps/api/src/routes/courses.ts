import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { CourseCatalogSchema, CourseDetailSchema, LessonProgressBodySchema, PlayInfoSchema } from "../contract";
import type { Env } from "../env";
import { validationHook } from "../lib/errors";
import { ERRORS, errorContent, jsonContent } from "../lib/route";
import { getCourseDetail, getPlayInfo, listCatalog, saveProgress } from "../services/courses";

const courseParams = z.object({ id: z.string() });
const lessonParams = z.object({ id: z.string(), lessonId: z.string() });

const listCourses = createRoute({
  method: "get",
  path: "/",
  tags: ["courses"],
  operationId: "listCourses",
  responses: { 200: jsonContent(CourseCatalogSchema, "已发布课程目录，含当前用户权限与进度") },
});
const getCourse = createRoute({
  method: "get",
  path: "/{id}",
  tags: ["courses"],
  operationId: "getCourse",
  request: { params: courseParams },
  responses: { 200: jsonContent(CourseDetailSchema, "课程详情（章 / 课时 / 进度）"), 404: ERRORS.notFound },
});
const playLesson = createRoute({
  method: "get",
  path: "/{id}/lessons/{lessonId}/play",
  tags: ["courses"],
  operationId: "getLessonPlayInfo",
  request: { params: lessonParams },
  responses: {
    200: jsonContent(PlayInfoSchema, "播放签名与续播位置"),
    403: errorContent("该课时需要开通课程后观看"),
    404: ERRORS.notFound,
    409: errorContent("视频处理中"),
  },
});
const putProgress = createRoute({
  method: "put",
  path: "/{id}/lessons/{lessonId}/progress",
  tags: ["courses"],
  operationId: "saveLessonProgress",
  request: {
    params: lessonParams,
    body: { required: true, content: { "application/json": { schema: LessonProgressBodySchema } } },
  },
  responses: {
    204: { description: "已记录" },
    400: ERRORS.badRequest,
    403: errorContent("该课时不可播放"),
    404: ERRORS.notFound,
  },
});

export const courseRoutes = new OpenAPIHono<Env>({ defaultHook: validationHook })
  .openapi(listCourses, async (c) => c.json(await listCatalog(c.var.userId, c.var.role), 200))
  .openapi(getCourse, async (c) =>
    c.json(await getCourseDetail(c.var.userId, c.var.role, c.req.valid("param").id), 200),
  )
  .openapi(playLesson, async (c) => {
    const { id, lessonId } = c.req.valid("param");
    return c.json(await getPlayInfo(c.var.userId, c.var.role, id, lessonId), 200);
  })
  .openapi(putProgress, async (c) => {
    const { id, lessonId } = c.req.valid("param");
    await saveProgress(c.var.userId, c.var.role, id, lessonId, c.req.valid("json"));
    return c.body(null, 204);
  });
