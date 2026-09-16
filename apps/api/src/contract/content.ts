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
    courses: z.array(
      z.object({
        id: z.string(),
        title: z.string(),
        description: z.string().nullable(),
        coverUrl: z.string().nullable(),
        lessons: z.array(
          z.object({
            id: z.string(),
            title: z.string(),
            videoUrl: z.string(),
            durationMinutes: z.number().nullable(),
            sortOrder: z.number(),
          }),
        ),
      }),
    ),
  })
  .openapi("StudentContent");
