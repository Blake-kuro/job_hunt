import { OpenAPIHono } from "@hono/zod-openapi";
import type { MiddlewareHandler } from "hono";
import type { Env } from "../../env";
import { AppError, validationHook } from "../../lib/errors";

/** requestUser 已注入 role 并拒绝了停用用户，这里只看角色 */
export const adminGuard: MiddlewareHandler<Env> = async (c, next) => {
  if (c.var.role !== "ADMIN") throw new AppError(403, "FORBIDDEN", "没有后台管理权限");
  await next();
};

export const newAdminRouter = () => new OpenAPIHono<Env>({ defaultHook: validationHook });
