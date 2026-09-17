import { createRoute, z } from "@hono/zod-openapi";
import {
  AdminChapterBodySchema,
  AdminChapterPatchSchema,
  AdminCourseBodySchema,
  AdminCourseDetailSchema,
  AdminCourseGrantBodySchema,
  AdminCourseListSchema,
  AdminCoursePatchSchema,
  AdminCourseStudentListSchema,
  AdminLessonBodySchema,
  AdminLessonOrderBodySchema,
  AdminLessonPatchSchema,
  AdminLessonSchema,
  IdResultSchema,
  UploadSignatureSchema,
  adminCourseQuerySchema,
  adminCourseStudentQuerySchema,
} from "../../contract";
import { ERRORS, errorContent, jsonContent } from "../../lib/route";
import { signUpload } from "../../lib/vod";
import * as courses from "../../services/admin-courses";
import { newAdminRouter } from "./guard";

const IdParam = z.object({ id: z.string() });
const jsonBody = <S>(schema: S) => ({ required: true as const, content: { "application/json": { schema } } });
const TAGS = ["admin"];

// ── 课程 ──
const listCourses = createRoute({
  method: "get",
  path: "/courses",
  tags: TAGS,
  operationId: "listAdminCourses",
  request: { query: adminCourseQuerySchema },
  responses: { 200: jsonContent(AdminCourseListSchema, "课程分页列表（含课时 / 就绪 / 授权计数）") },
});
const getCourse = createRoute({
  method: "get",
  path: "/courses/{id}",
  tags: TAGS,
  operationId: "getAdminCourse",
  request: { params: IdParam },
  responses: { 200: jsonContent(AdminCourseDetailSchema, "课程详情（含章 / 课时全量）"), 404: ERRORS.notFound },
});
const createCourse = createRoute({
  method: "post",
  path: "/courses",
  tags: TAGS,
  operationId: "createAdminCourse",
  request: { body: jsonBody(AdminCourseBodySchema) },
  responses: { 201: jsonContent(IdResultSchema, "已创建"), 400: ERRORS.badRequest },
});
const updateCourse = createRoute({
  method: "patch",
  path: "/courses/{id}",
  tags: TAGS,
  operationId: "updateAdminCourse",
  request: { params: IdParam, body: jsonBody(AdminCoursePatchSchema) },
  responses: { 204: { description: "已更新" }, 400: ERRORS.badRequest, 404: ERRORS.notFound },
});
const deleteCourse = createRoute({
  method: "delete",
  path: "/courses/{id}",
  tags: TAGS,
  operationId: "deleteAdminCourse",
  request: { params: IdParam },
  responses: { 204: { description: "已删除（级联章 / 课时 / 进度，并清理授权）" }, 404: ERRORS.notFound },
});

// ── 章 ──
const createChapter = createRoute({
  method: "post",
  path: "/courses/{id}/chapters",
  tags: TAGS,
  operationId: "createAdminChapter",
  request: { params: IdParam, body: jsonBody(AdminChapterBodySchema) },
  responses: { 201: jsonContent(IdResultSchema, "已创建（排在最后）"), 400: ERRORS.badRequest, 404: ERRORS.notFound },
});
const updateChapter = createRoute({
  method: "patch",
  path: "/chapters/{id}",
  tags: TAGS,
  operationId: "updateAdminChapter",
  request: { params: IdParam, body: jsonBody(AdminChapterPatchSchema) },
  responses: { 204: { description: "已更新" }, 400: ERRORS.badRequest, 404: ERRORS.notFound },
});
const deleteChapter = createRoute({
  method: "delete",
  path: "/chapters/{id}",
  tags: TAGS,
  operationId: "deleteAdminChapter",
  request: { params: IdParam },
  responses: { 204: { description: "已删除（课时回到无章）" }, 404: ERRORS.notFound },
});

// ── 课时 ──
const createLesson = createRoute({
  method: "post",
  path: "/courses/{id}/lessons",
  tags: TAGS,
  operationId: "createAdminLesson",
  request: { params: IdParam, body: jsonBody(AdminLessonBodySchema) },
  responses: {
    201: jsonContent(IdResultSchema, "已创建（排在最后）"),
    400: errorContent("参数校验失败或章不属于该课程"),
    404: ERRORS.notFound,
  },
});
const updateLesson = createRoute({
  method: "patch",
  path: "/lessons/{id}",
  tags: TAGS,
  operationId: "updateAdminLesson",
  request: { params: IdParam, body: jsonBody(AdminLessonPatchSchema) },
  responses: {
    204: { description: "已更新（写 videoFileId 时状态置 PROCESSING）" },
    400: errorContent("参数校验失败或章不属于该课程"),
    404: ERRORS.notFound,
  },
});
const deleteLesson = createRoute({
  method: "delete",
  path: "/lessons/{id}",
  tags: TAGS,
  operationId: "deleteAdminLesson",
  request: { params: IdParam },
  responses: { 204: { description: "已删除（级联进度）" }, 404: ERRORS.notFound },
});
const reorderLessons = createRoute({
  method: "put",
  path: "/courses/{id}/lessons/order",
  tags: TAGS,
  operationId: "reorderAdminLessons",
  request: { params: IdParam, body: jsonBody(AdminLessonOrderBodySchema) },
  responses: {
    204: { description: "已写入章顺序与课时归属 / 顺序" },
    400: errorContent("课时未覆盖全部 / 重复 / 不属于该课程，或章不属于该课程"),
    404: ERRORS.notFound,
  },
});
const refreshLessonVideo = createRoute({
  method: "post",
  path: "/lessons/{id}/video/refresh",
  tags: TAGS,
  operationId: "refreshAdminLessonVideo",
  request: { params: IdParam },
  responses: {
    200: jsonContent(AdminLessonSchema, "已按 VOD 媒体信息回填状态 / 时长"),
    400: errorContent("该课时还没有上传视频"),
    404: ERRORS.notFound,
  },
});

// ── 上传 ──
const uploadSignature = createRoute({
  method: "post",
  path: "/vod/upload-signature",
  tags: TAGS,
  operationId: "createVodUploadSignature",
  responses: { 200: jsonContent(UploadSignatureSchema, "VOD 客户端直传签名（1 小时）") },
});

// ── 按课授权 ──
const listStudents = createRoute({
  method: "get",
  path: "/courses/{id}/students",
  tags: TAGS,
  operationId: "listAdminCourseStudents",
  request: { params: IdParam, query: adminCourseStudentQuerySchema },
  responses: { 200: jsonContent(AdminCourseStudentListSchema, "已开通学员（含进度）"), 404: ERRORS.notFound },
});
const grantCourse = createRoute({
  method: "post",
  path: "/courses/{id}/grants",
  tags: TAGS,
  operationId: "grantAdminCourse",
  request: { params: IdParam, body: jsonBody(AdminCourseGrantBodySchema) },
  responses: {
    204: { description: "已开通（幂等；已有授权只更新到期）" },
    400: errorContent("参数校验失败或学生不存在"),
    404: ERRORS.notFound,
  },
});
const revokeGrant = createRoute({
  method: "delete",
  path: "/courses/{id}/grants/{userId}",
  tags: TAGS,
  operationId: "revokeAdminCourseGrant",
  request: { params: z.object({ id: z.string(), userId: z.string() }) },
  responses: { 204: { description: "已移除" }, 404: errorContent("课程或授权不存在") },
});

export const courseRoutes = newAdminRouter()
  .openapi(listCourses, async (c) => c.json(await courses.listCourses(c.req.valid("query")), 200))
  .openapi(getCourse, async (c) => c.json(await courses.getCourse(c.req.valid("param").id), 200))
  .openapi(createCourse, async (c) => c.json({ id: await courses.createCourse(c.req.valid("json")) }, 201))
  .openapi(updateCourse, async (c) => {
    await courses.updateCourse(c.req.valid("param").id, c.req.valid("json"));
    return c.body(null, 204);
  })
  .openapi(deleteCourse, async (c) => {
    await courses.deleteCourse(c.req.valid("param").id);
    return c.body(null, 204);
  })
  .openapi(createChapter, async (c) =>
    c.json({ id: await courses.createChapter(c.req.valid("param").id, c.req.valid("json").title) }, 201),
  )
  .openapi(updateChapter, async (c) => {
    await courses.updateChapter(c.req.valid("param").id, c.req.valid("json"));
    return c.body(null, 204);
  })
  .openapi(deleteChapter, async (c) => {
    await courses.deleteChapter(c.req.valid("param").id);
    return c.body(null, 204);
  })
  .openapi(createLesson, async (c) =>
    c.json({ id: await courses.createLesson(c.req.valid("param").id, c.req.valid("json")) }, 201),
  )
  .openapi(updateLesson, async (c) => {
    await courses.updateLesson(c.req.valid("param").id, c.req.valid("json"));
    return c.body(null, 204);
  })
  .openapi(deleteLesson, async (c) => {
    await courses.deleteLesson(c.req.valid("param").id);
    return c.body(null, 204);
  })
  .openapi(reorderLessons, async (c) => {
    await courses.reorderLessons(c.req.valid("param").id, c.req.valid("json"));
    return c.body(null, 204);
  })
  .openapi(refreshLessonVideo, async (c) => c.json(await courses.refreshLessonVideo(c.req.valid("param").id), 200))
  .openapi(uploadSignature, async (c) => c.json(signUpload(), 200))
  .openapi(listStudents, async (c) =>
    c.json(await courses.listCourseStudents(c.req.valid("param").id, c.req.valid("query")), 200),
  )
  .openapi(grantCourse, async (c) => {
    await courses.grantCourse(c.req.valid("param").id, c.req.valid("json"), c.var.userId);
    return c.body(null, 204);
  })
  .openapi(revokeGrant, async (c) => {
    const { id, userId } = c.req.valid("param");
    await courses.revokeCourseGrant(id, userId);
    return c.body(null, 204);
  });
