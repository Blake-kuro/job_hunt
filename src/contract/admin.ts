import { z } from "@hono/zod-openapi";
import { PlanSchema, TierSchema } from "./access";
import { CategoryIdSchema, jobListQuerySchema } from "./job";
import { AnswerLettersSchema, QuestionTypeSchema, QuizOptionSchema, quizOptionsSchema } from "./quiz";

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
    companies: z.number().int(),
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
    companies: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        sortOrder: z.number().int(),
        categories: z.array(
          z.object({
            id: z.string(),
            name: z.string(),
            sortOrder: z.number().int(),
            questionCount: z.number().int(),
            publishedCount: z.number().int(),
          }),
        ),
      }),
    ),
  })
  .openapi("AdminQuizMeta");
export const adminQuestionQuerySchema = z.object({
  q: z.string().trim().min(1).optional(),
  companyId: z.string().min(1).optional(),
  categoryId: z.string().min(1).optional(),
  type: QuestionTypeSchema.optional(),
  section: z.string().trim().min(1).optional(),
  published: BoolQuery,
  ...pageQuery,
});
export const DifficultySchema = z.enum(["EASY", "MEDIUM", "HARD"]).openapi("Difficulty");
export const AdminQuestionSchema = z
  .object({
    id: z.string(),
    companyId: z.string(),
    companyName: z.string(),
    categoryId: z.string(),
    categoryName: z.string(),
    type: QuestionTypeSchema,
    section: z.string().nullable(),
    sortOrder: z.number().int(),
    prompt: z.string(),
    options: z.array(QuizOptionSchema),
    answer: AnswerLettersSchema,
    explanation: z.array(z.string()),
    difficulty: DifficultySchema,
    source: z.string(),
    published: z.boolean(),
  })
  .openapi("AdminQuestion");
export const AdminQuestionListSchema = paged(AdminQuestionSchema, "AdminQuestionList");
export const AdminQuestionBodySchema = z
  .object({
    categoryId: z.string().min(1),
    type: QuestionTypeSchema,
    section: z.string().trim().nullable().optional(),
    sortOrder: z.number().int().optional(),
    prompt: z.string().min(1),
    options: quizOptionsSchema,
    answer: AnswerLettersSchema,
    explanation: z.array(z.string()),
    difficulty: DifficultySchema,
    source: z.string().min(1),
    published: z.boolean(),
  })
  .openapi("AdminQuestionBody");
export const AdminQuestionPatchSchema = AdminQuestionBodySchema.partial().openapi("AdminQuestionPatch");
const BankName = z.string().trim().min(1).max(50);
export const AdminCompanySchema = z
  .object({ id: z.string(), name: z.string(), sortOrder: z.number().int() })
  .openapi("AdminCompany");
export const AdminCompanyBodySchema = z.object({ name: BankName }).openapi("AdminCompanyBody");
export const AdminCompanyPatchSchema = z
  .object({ name: BankName.optional(), sortOrder: z.number().int().optional() })
  .openapi("AdminCompanyPatch");
export const AdminCategorySchema = z
  .object({ id: z.string(), companyId: z.string(), name: z.string(), sortOrder: z.number().int() })
  .openapi("AdminCategory");
export const AdminCategoryBodySchema = z
  .object({ companyId: z.string().min(1), name: BankName })
  .openapi("AdminCategoryBody");
export const AdminCategoryPatchSchema = z
  .object({ name: BankName.optional(), sortOrder: z.number().int().optional() })
  .openapi("AdminCategoryPatch");
export const AdminQuestionImportResultSchema = z
  .object({ created: z.number().int(), skipped: z.array(z.string()) })
  .openapi("AdminQuestionImportResult");
export type AdminQuestionImportResult = z.infer<typeof AdminQuestionImportResultSchema>;

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
