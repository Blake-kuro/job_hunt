import { z } from "@hono/zod-openapi";

export const ApiErrorCodeSchema = z.enum(["VALIDATION", "NOT_FOUND", "INTERNAL"]).openapi("ApiErrorCode");
export type ApiErrorCode = z.infer<typeof ApiErrorCodeSchema>;

export const ApiErrorSchema = z
  .object({
    error: z.object({
      code: ApiErrorCodeSchema,
      message: z.string(),
      issues: z.array(z.unknown()).optional(),
    }),
  })
  .openapi("ApiError");
export type ApiErrorBody = z.infer<typeof ApiErrorSchema>;
