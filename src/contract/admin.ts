import { z } from "@hono/zod-openapi";

export const ContentTypeSchema = z.enum(["MATERIAL", "QUESTION", "COURSE"]).openapi("ContentType");
const NullableDateSchema = z.string().datetime().nullable();

export const AdminStudentPatchSchema = z
  .object({
    enabled: z.boolean().optional(),
    plan: z.enum(["FREE", "PRO"]).optional(),
    proExpiresAt: NullableDateSchema.optional(),
  })
  .openapi("AdminStudentPatch");

export const AdminContentBodySchema = z
  .object({
    id: z.string().optional(),
    type: z.enum(["MATERIAL", "COURSE"]),
    title: z.string().min(1),
    description: z.string().nullable().optional(),
    category: z.string().optional(),
    url: z.string().url().optional(),
    coverUrl: z.string().url().nullable().optional(),
    published: z.boolean(),
    lessons: z
      .array(
        z.object({
          title: z.string().min(1),
          videoUrl: z.string().url(),
          durationMinutes: z.number().int().positive().nullable().optional(),
        }),
      )
      .optional(),
  })
  .openapi("AdminContentBody");

export const AdminAccessBodySchema = z
  .object({
    grants: z.array(
      z.object({ contentType: ContentTypeSchema, contentId: z.string(), expiresAt: NullableDateSchema.optional() }),
    ),
  })
  .openapi("AdminAccessBody");

export const AdminQuestionBodySchema = z
  .object({
    prompt: z.string().min(1),
    categoryId: z.string(),
    companySetId: z.string().nullable().optional(),
    options: z.array(z.object({ letter: z.enum(["A", "B", "C", "D"]), text: z.string() })).length(4),
    answer: z.enum(["A", "B", "C", "D"]),
    explanation: z.array(z.string()),
    difficulty: z.enum(["EASY", "MEDIUM", "HARD"]),
    source: z.string(),
    published: z.boolean(),
  })
  .openapi("AdminQuestionBody");

export const AdminDashboardSchema = z
  .object({
    summary: z.object({
      students: z.number(),
      enabledStudents: z.number(),
      materials: z.number(),
      courses: z.number(),
      questions: z.number(),
    }),
    students: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        phone: z.string().nullable(),
        enabled: z.boolean(),
        plan: z.enum(["FREE", "PRO"]),
        proExpiresAt: NullableDateSchema,
        createdAt: z.string(),
        grants: z.array(
          z.object({
            id: z.string(),
            contentType: ContentTypeSchema,
            contentId: z.string(),
            expiresAt: NullableDateSchema,
          }),
        ),
      }),
    ),
    materials: z.array(
      z.object({
        id: z.string(),
        title: z.string(),
        description: z.string().nullable(),
        category: z.string(),
        resourceUrl: z.string(),
        published: z.boolean(),
        updatedAt: z.string(),
      }),
    ),
    courses: z.array(
      z.object({
        id: z.string(),
        title: z.string(),
        description: z.string().nullable(),
        coverUrl: z.string().nullable(),
        published: z.boolean(),
        updatedAt: z.string(),
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
    categories: z.array(z.object({ id: z.string(), name: z.string() })),
    questions: z.array(
      z.object({
        id: z.string(),
        prompt: z.string(),
        categoryId: z.string(),
        options: z.unknown(),
        answer: z.string(),
        explanation: z.array(z.string()),
        difficulty: z.string(),
        source: z.string(),
        published: z.boolean(),
      }),
    ),
  })
  .openapi("AdminDashboard");
