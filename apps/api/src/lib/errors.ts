import type { Hook } from "@hono/zod-validator";
import type { ErrorHandler } from "hono";
import type { Env } from "../env";

export class NotFoundError extends Error {
  constructor(message = "not found") {
    super(message);
    this.name = "NotFoundError";
  }
}

/** zValidator 第三参：校验失败统一 400 */
// biome-ignore lint/suspicious/noExplicitAny: 通用 hook，对任意 schema / 路由生效
export const validationHook: Hook<any, any, any> = (result, c) => {
  if (!result.success) {
    return c.json({ error: { code: "VALIDATION", message: "参数校验失败", issues: result.error.issues } }, 400);
  }
};

export const errorHandler: ErrorHandler<Env> = (err, c) => {
  if (err instanceof NotFoundError) {
    return c.json({ error: { code: "NOT_FOUND", message: err.message } }, 404);
  }
  console.error(err);
  return c.json({ error: { code: "INTERNAL", message: "服务器内部错误" } }, 500);
};
