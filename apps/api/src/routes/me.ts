import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { MyCoursesSchema, UserSchema } from "../contract";
import type { Env } from "../env";
import { validationHook } from "../lib/errors";
import { jsonContent } from "../lib/route";
import { listMyCourses } from "../services/courses";
import { getCurrentUser } from "../services/users";

const getMe = createRoute({
  method: "get",
  path: "/",
  tags: ["me"],
  operationId: "getMe",
  responses: { 200: jsonContent(UserSchema, "当前用户") },
});
const getMyCourses = createRoute({
  method: "get",
  path: "/courses",
  tags: ["me"],
  operationId: "listMyCourses",
  responses: { 200: jsonContent(MyCoursesSchema, "有授权或有学习进度的课程，按最近学习排序") },
});

export const meRoutes = new OpenAPIHono<Env>({ defaultHook: validationHook })
  .openapi(getMe, async (c) => c.json(await getCurrentUser(c.var.userId), 200))
  .openapi(getMyCourses, async (c) => c.json(await listMyCourses(c.var.userId, c.var.role), 200));
