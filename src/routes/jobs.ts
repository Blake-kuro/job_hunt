import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import {
  ApiErrorSchema,
  ApplicationBodySchema,
  ApplicationResultSchema,
  FavoriteResultSchema,
  IdParamSchema,
  JobListResultSchema,
  JobProgressSchema,
  jobListQuerySchema,
} from "../contract";
import type { Env } from "../env";
import { validationHook } from "../lib/errors";
import { getProgress, listJobs, setApplication, setFavorite } from "../services/jobs";

const json = <S>(schema: S, description: string) => ({ description, content: { "application/json": { schema } } });
const badRequest = json(ApiErrorSchema, "参数校验失败");
const notFound = json(ApiErrorSchema, "岗位不存在");

const listJobsRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["jobs"],
  operationId: "listJobs",
  request: { query: jobListQuerySchema },
  responses: { 200: json(JobListResultSchema, "岗位列表"), 400: badRequest },
});

const progressRoute = createRoute({
  method: "get",
  path: "/progress",
  tags: ["jobs"],
  operationId: "getJobProgress",
  responses: { 200: json(JobProgressSchema, "我的进度") },
});

const addFavoriteRoute = createRoute({
  method: "put",
  path: "/{id}/favorite",
  tags: ["jobs"],
  operationId: "addFavorite",
  request: { params: IdParamSchema },
  responses: { 200: json(FavoriteResultSchema, "已收藏"), 400: badRequest, 404: notFound },
});

const removeFavoriteRoute = createRoute({
  method: "delete",
  path: "/{id}/favorite",
  tags: ["jobs"],
  operationId: "removeFavorite",
  request: { params: IdParamSchema },
  responses: { 200: json(FavoriteResultSchema, "已取消收藏"), 400: badRequest, 404: notFound },
});

const setApplicationRoute = createRoute({
  method: "put",
  path: "/{id}/application",
  tags: ["jobs"],
  operationId: "setApplication",
  request: { params: IdParamSchema, body: { content: { "application/json": { schema: ApplicationBodySchema } } } },
  responses: { 200: json(ApplicationResultSchema, "投递状态"), 400: badRequest, 404: notFound },
});

const clearApplicationRoute = createRoute({
  method: "delete",
  path: "/{id}/application",
  tags: ["jobs"],
  operationId: "clearApplication",
  request: { params: IdParamSchema },
  responses: { 200: json(ApplicationResultSchema, "已清除投递状态"), 400: badRequest, 404: notFound },
});

export const jobRoutes = new OpenAPIHono<Env>({ defaultHook: validationHook })
  .openapi(listJobsRoute, async (c) => c.json(await listJobs(c.req.valid("query"), c.var.userId), 200))
  .openapi(progressRoute, async (c) => c.json(await getProgress(c.var.userId), 200))
  .openapi(addFavoriteRoute, async (c) => c.json(await setFavorite(c.req.valid("param").id, c.var.userId, true), 200))
  .openapi(removeFavoriteRoute, async (c) =>
    c.json(await setFavorite(c.req.valid("param").id, c.var.userId, false), 200),
  )
  .openapi(setApplicationRoute, async (c) =>
    c.json(await setApplication(c.req.valid("param").id, c.var.userId, c.req.valid("json").status), 200),
  )
  .openapi(clearApplicationRoute, async (c) =>
    c.json(await setApplication(c.req.valid("param").id, c.var.userId, null), 200),
  );
