import { z } from "@hono/zod-openapi";

export const StudentContentSchema = z
  .object({
    materials: z.array(
      z.object({
        id: z.string(),
        title: z.string(),
        description: z.string().nullable(),
        category: z.string(),
        resourceUrl: z.string(),
      }),
    ),
  })
  .openapi("StudentContent");
