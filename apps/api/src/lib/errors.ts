import { HTTPException } from "hono/http-exception";
import type { Context, ErrorHandler } from "hono";
import type { Env } from "../env";

export class NotFoundError extends Error {
  constructor(message = "not found") {
    super(message);
    this.name = "NotFoundError";
  }
}

/** zValidator 第三参：校验失败统一 400 */
export const validationHook = (
  result: { success: boolean; error?: { issues: unknown[] } },
  c: Pick<Context, "json">,
) => {
  if (!result.success) {
    return c.json({ error: { code: "VALIDATION", message: "参数校验失败", issues: result.error?.issues } }, 400);
  }
};

export const errorHandler: ErrorHandler<Env> = (err, c) => {
  if (err instanceof HTTPException && err.status === 400) {
    return c.json({ error: { code: "VALIDATION", message: "请求 JSON 格式无效" } }, 400);
  }
  if (err instanceof NotFoundError) {
    return c.json({ error: { code: "NOT_FOUND", message: err.message } }, 404);
  }
  console.error(err);
  return c.json({ error: { code: "INTERNAL", message: "服务器内部错误" } }, 500);
};
