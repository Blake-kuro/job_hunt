import { z } from "@hono/zod-openapi";
import { PlanSchema, TierSchema } from "./access";
import { CategoryIdSchema, jobListQuerySchema } from "./job";
import { QuizOptionLetterSchema, QuizOptionSchema } from "./quiz";

export const ContentTypeSchema = z.enum(["MATERIAL", "QUESTION", "COURSE"]).openapi("ContentType");
const NullableDateTime = z.string().datetime().nullable();
const DateKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日期格式为 YYYY-MM-DD");
const BoolQuery = z
  .enum(["true", "false"])
  .transform((v) => v === "true")
  .optional();

const pageQuery = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
};
const paged = <T extends z.ZodTypeAny>(item: T, name: string) =>
  z
    .object({ items: z.array(item), total: z.number().int(), page: z.number().int(), pageSize: z.number().int() })
    .openapi(name);

export const IdResultSchema = z.object({ id: z.string() }).openapi("IdResult");
export const IntIdResultSchema = z.object({ id: z.number().int() }).openapi("IntIdResult");

// ── 概览 ──
export const AdminSummarySchema = z
  .object({
    students: z.number().int(),
    enabledStudents: z.number().int(),
    proStudents: z.number().int(),
    guests: z.number().int(),
    jobs: z.number().int(),
    questions: z.number().int(),
    publishedQuestions: z.number().int(),
    materials: z.number().int(),
    courses: z.number().int(),
  })
  .openapi("AdminSummary");

// ── 学生 ──
export const adminStudentQuerySchema = z.object({
  q: z.string().trim().min(1).optional(),
  plan: PlanSchema.optional(),
  enabled: BoolQuery,
  ...pageQuery,
});
export const AdminGrantSchema = z
  .object({
    id: z.string(),
    contentType: ContentTypeSchema,
    contentId: z.string(),
    contentTitle: z.string().nullable(),
    expiresAt: NullableDateTime,
  })
  .openapi("AdminGrant");
export const AdminStudentSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    phone: z.string().nullable(),
    role: z.enum(["STUDENT", "ADMIN"]),
    enabled: z.boolean(),
    plan: PlanSchema,
    proExpiresAt: NullableDateTime,
    tier: TierSchema,
    createdAt: z.string().datetime(),
    stats: z.object({ favorites: z.number().int(), applications: z.number().int(), attempts: z.number().int() }),
    grants: z.array(AdminGrantSchema),
  })
  .openapi("AdminStudent");
export const AdminStudentListSchema = paged(AdminStudentSchema, "AdminStudentList");
export const AdminStudentPatchSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    enabled: z.boolean().optional(),
    plan: PlanSchema.optional(),
    proExpiresAt: NullableDateTime.optional(),
  })
  .openapi("AdminStudentPatch");
export const AdminAccessBodySchema = z
  .object({
    grants: z.array(
      z.object({
        contentType: ContentTypeSchema,
        contentId: z.string().min(1),
        expiresAt: NullableDateTime.optional(),
      }),
    ),
  })
  .openapi("AdminAccessBody");

// ── 资料 / 课程 ──
export const AdminMaterialSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    description: z.string().nullable(),
    category: z.string(),
    resourceUrl: z.string(),
    published: z.boolean(),
    updatedAt: z.string().datetime(),
  })
  .openapi("AdminMaterial");
export const AdminCourseLessonSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    videoUrl: z.string(),
    durationMinutes: z.number().int().nullable(),
    sortOrder: z.number().int(),
  })
  .openapi("AdminCourseLesson");
export const AdminCourseSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    description: z.string().nullable(),
    coverUrl: z.string().nullable(),
    published: z.boolean(),
    updatedAt: z.string().datetime(),
    lessons: z.array(AdminCourseLessonSchema),
  })
  .openapi("AdminCourse");
const AdminCourseLessonBodySchema = z.object({
  title: z.string().min(1),
  videoUrl: z.string().url(),
  durationMinutes: z.number().int().positive().nullable().optional(),
});
const AdminMaterialBodySchema = z
  .object({
    type: z.literal("MATERIAL"),
    id: z.string().optional(),
    title: z.string().min(1),
    description: z.string().nullable().optional(),
    category: z.string().optional(),
    url: z.string().url(),
    published: z.boolean(),
  })
  .openapi("AdminMaterialBody");
const AdminCourseBodySchema = z
  .object({
    type: z.literal("COURSE"),
    id: z.string().optional(),
    title: z.string().min(1),
    description: z.string().nullable().optional(),
    coverUrl: z.string().url().nullable().optional(),
    published: z.boolean(),
    lessons: z.array(AdminCourseLessonBodySchema),
  })
  .openapi("AdminCourseBody");
export const AdminContentBodySchema = z
  .discriminatedUnion("type", [AdminMaterialBodySchema, AdminCourseBodySchema])
  .openapi("AdminContentBody");

// ── 题库 ──
export const AdminQuizMetaSchema = z
  .object({
    categories: z.array(z.object({ id: z.string(), name: z.string(), questionCount: z.number().int() })),
    companySets: z.array(z.object({ id: z.string(), company: z.string(), track: z.string(), focus: z.string() })),
  })
  .openapi("AdminQuizMeta");
export const adminQuestionQuerySchema = z.object({
  q: z.string().trim().min(1).optional(),
  categoryId: z.string().min(1).optional(),
  published: BoolQuery,
  ...pageQuery,
});
export const DifficultySchema = z.enum(["EASY", "MEDIUM", "HARD"]).openapi("Difficulty");
export const AdminQuestionSchema = z
  .object({
    id: z.string(),
    prompt: z.string(),
    categoryId: z.string(),
    categoryName: z.string(),
    companySetId: z.string().nullable(),
    options: z.array(QuizOptionSchema),
    answer: QuizOptionLetterSchema,
    explanation: z.array(z.string()),
    difficulty: DifficultySchema,
    source: z.string(),
    published: z.boolean(),
  })
  .openapi("AdminQuestion");
export const AdminQuestionListSchema = paged(AdminQuestionSchema, "AdminQuestionList");
export const AdminQuestionBodySchema = z
  .object({
    prompt: z.string().min(1),
    categoryId: z.string().min(1),
    companySetId: z.string().nullable().optional(),
    options: z.array(QuizOptionSchema).length(4),
    answer: QuizOptionLetterSchema,
    explanation: z.array(z.string()),
    difficulty: DifficultySchema,
    source: z.string().min(1),
    published: z.boolean(),
  })
  .openapi("AdminQuestionBody");
export const AdminQuestionPatchSchema = AdminQuestionBodySchema.partial().openapi("AdminQuestionPatch");
export const AdminCategoryBodySchema = z
  .object({ name: z.string().trim().min(1).max(30) })
  .openapi("AdminCategoryBody");
export const AdminCategorySchema = z.object({ id: z.string(), name: z.string() }).openapi("AdminCategory");

// ── 岗位 ──
export const adminJobQuerySchema = z.object({
  q: z.string().trim().min(1).optional(),
  category: jobListQuerySchema.shape.category,
  ...pageQuery,
});
const NullableText = z.string().nullable();
export const AdminJobSchema = z
  .object({
    id: z.number().int(),
    serialNumber: NullableText,
    categoryId: CategoryIdSchema,
    recruitmentBatch: NullableText,
    enterpriseNature: NullableText,
    industry: NullableText,
    workLocation: NullableText,
    position: z.string(),
    enterpriseName: z.string(),
    graduationYear: NullableText,
    degree: NullableText,
    announcementLink: NullableText,
    deliveryAddress: NullableText,
    deadline: NullableText,
    deadlineAt: DateKeySchema.nullable(),
    createTime: z.string().datetime(),
    updateTime: z.string().datetime(),
    stats: z.object({ favorites: z.number().int(), applications: z.number().int() }),
  })
  .openapi("AdminJob");
export const AdminJobListSchema = paged(AdminJobSchema, "AdminJobList");
const OptText = z.string().nullable().optional();
export const AdminJobBodySchema = z
  .object({
    categoryId: CategoryIdSchema,
    position: z.string().trim().min(1),
    enterpriseName: z.string().trim().min(1),
    serialNumber: OptText,
    recruitmentBatch: OptText,
    enterpriseNature: OptText,
    industry: OptText,
    workLocation: OptText,
    graduationYear: OptText,
    degree: OptText,
    announcementLink: OptText,
    deliveryAddress: OptText,
    deadline: OptText,
    deadlineAt: DateKeySchema.nullable().optional(),
  })
  .openapi("AdminJobBody");
export const AdminJobPatchSchema = AdminJobBodySchema.partial().openapi("AdminJobPatch");
export const AdminImportResultSchema = z
  .object({
    sheets: z.array(
      z.object({
        name: z.string(),
        created: z.number().int(),
        updated: z.number().int(),
        skipped: z.array(z.string()),
      }),
    ),
    usedIdKey: z.boolean(),
  })
  .openapi("AdminImportResult");
export type AdminImportResult = z.infer<typeof AdminImportResultSchema>;
