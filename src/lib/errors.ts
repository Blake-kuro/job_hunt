import type { Hook } from "@hono/zod-openapi";
import type { ErrorHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import type { Env } from "../env";
import type { ApiErrorCode } from "../contract";

export class NotFoundError extends Error {
  constructor(message = "not found") {
    super(message);
    this.name = "NotFoundError";
  }
}

export class AppError extends Error {
  constructor(
    readonly status: 400 | 401 | 403 | 429,
    readonly code: ApiErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

/** OpenAPIHono 的 defaultHook：校验失败统一 400 */
// biome-ignore lint/suspicious/noExplicitAny: 对所有路由生效的通用 hook
export const validationHook: Hook<any, Env, any, any> = (result, c) => {
  if (!result.success) {
    return c.json(
      { error: { code: "VALIDATION" as const, message: "参数校验失败", issues: result.error.issues } },
      400,
    );
  }
};

export const errorHandler: ErrorHandler<Env> = (err, c) => {
  if (err instanceof AppError) {
    return c.json({ error: { code: err.code, message: err.message } }, err.status);
  }
  if (err instanceof HTTPException && err.status === 415) {
    return c.json({ error: { code: "VALIDATION", message: "Content-Type 必须是 application/json" } }, 400);
  }
  if (err instanceof HTTPException && err.status === 413) {
    return c.json({ error: { code: "VALIDATION", message: "文件超过 20 MB" } }, 400);
  }
  if (err instanceof HTTPException && err.status === 400) {
    return c.json({ error: { code: "VALIDATION", message: "请求 JSON 格式无效" } }, 400);
  }
  if (err instanceof NotFoundError) {
    return c.json({ error: { code: "NOT_FOUND", message: err.message } }, 404);
  }
  console.error(err);
  return c.json({ error: { code: "INTERNAL", message: "服务器内部错误" } }, 500);
};
