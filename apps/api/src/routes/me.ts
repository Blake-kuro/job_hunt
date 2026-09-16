import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { UserSchema } from "../contract";
import type { Env } from "../env";
import { validationHook } from "../lib/errors";
import { jsonContent } from "../lib/route";
import { getCurrentUser } from "../services/users";

const getMe = createRoute({
  method: "get",
  path: "/",
  tags: ["me"],
  operationId: "getMe",
  responses: { 200: jsonContent(UserSchema, "当前用户") },
});

export const meRoutes = new OpenAPIHono<Env>({ defaultHook: validationHook }).openapi(getMe, async (c) =>
  c.json(await getCurrentUser(c.var.userId), 200),
);
