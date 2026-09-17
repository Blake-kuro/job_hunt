import { ApiErrorSchema } from "../contract";
import { NotFoundError } from "./errors";

/** OpenAPI 响应片段：`{ description, content: { "application/json": { schema } } }` */
export const jsonContent = <S>(schema: S, description: string) => ({
  description,
  content: { "application/json": { schema } },
});

/** 错误响应片段（固定 `ApiErrorSchema`），只需给 description */
export const errorContent = (description: string) => jsonContent(ApiErrorSchema, description);

/** 常见错误响应的预制片段，文案与各路由现有 description 一致时直接复用 */
export const ERRORS = {
  badRequest: errorContent("参数校验失败"),
  notFound: errorContent("不存在"),
} as const;

/** `findUnique` 之后的存在性校验：`null`/`undefined` → `NotFoundError`，否则收窄为 `T` */
export function orNotFound<T>(row: T | null | undefined, message: string): T {
  if (row == null) throw new NotFoundError(message);
  return row;
}
