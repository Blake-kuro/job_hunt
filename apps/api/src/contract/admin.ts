import { z } from "@hono/zod-openapi";
import { PlanSchema, TierSchema } from "./access";
import { VideoStatusSchema } from "./course";
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
    /** `videoStatus === "READY"` 的课时数 */
    readyLessons: z.number().int(),
    /** `AccessGrant{COURSE}` 行数 */
    courseGrants: z.number().int(),
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

// ── 资料 ──
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
/** `POST /content` 只收资料（课程走 `/courses`）；带 `id` 为更新 */
export const AdminMaterialBodySchema = z
  .object({
    id: z.string().optional(),
    title: z.string().min(1),
    description: z.string().nullable().optional(),
    category: z.string().optional(),
    url: z.string().url(),
    published: z.boolean(),
  })
  .openapi("AdminMaterialBody");

// ── 课程 / 章 / 课时 ──
export const adminCourseQuerySchema = z.object({
  q: z.string().trim().min(1).optional(),
  published: BoolQuery,
  ...pageQuery,
});
const adminCourseShape = {
  id: z.string(),
  title: z.string(),
  summary: z.string().nullable(),
  coverUrl: z.string().nullable(),
  teacher: z.string().nullable(),
  /** 标价，分；0 = 免费课 */
  priceCents: z.number().int(),
  published: z.boolean(),
  sortOrder: z.number().int(),
  lessonCount: z.number().int(),
  /** `videoStatus === "READY"` 的课时数 */
  readyCount: z.number().int(),
  /** `AccessGrant{COURSE}` 行数（含已过期） */
  grantCount: z.number().int(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
};
export const AdminCourseSchema = z.object(adminCourseShape).openapi("AdminCourse");
export type AdminCourse = z.infer<typeof AdminCourseSchema>;
export const AdminCourseListSchema = paged(AdminCourseSchema, "AdminCourseList");
export const AdminLessonSchema = z
  .object({
    id: z.string(),
    chapterId: z.string().nullable(),
    title: z.string(),
    sortOrder: z.number().int(),
    freePreview: z.boolean(),
    videoFileId: z.string().nullable(),
    videoStatus: VideoStatusSchema,
    durationSeconds: z.number().int().nullable(),
  })
  .openapi("AdminLesson");
export type AdminLesson = z.infer<typeof AdminLessonSchema>;
export const AdminChapterSchema = z
  .object({ id: z.string(), title: z.string(), sortOrder: z.number().int(), lessons: z.array(AdminLessonSchema) })
  .openapi("AdminChapter");
export const AdminCourseDetailSchema = z
  .object({
    ...adminCourseShape,
    description: z.string().nullable(),
    chapters: z.array(AdminChapterSchema),
    /** 不属于任何章的课时 */
    unchaptered: z.array(AdminLessonSchema),
  })
  .openapi("AdminCourseDetail");
export type AdminCourseDetail = z.infer<typeof AdminCourseDetailSchema>;
const CourseTitle = z.string().trim().min(1).max(200);
/** 可空短文本：trim 后空串归一为 null */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null)
    .nullable()
    .optional();
export const AdminCourseBodySchema = z
  .object({
    title: CourseTitle,
    summary: optionalText(500),
    description: optionalText(5000),
    teacher: optionalText(100),
    priceCents: z.number().int().min(0),
    coverUrl: z.string().url().nullable().optional(),
    published: z.boolean(),
    sortOrder: z.number().int().optional(),
  })
  .openapi("AdminCourseBody");
export type AdminCourseBody = z.infer<typeof AdminCourseBodySchema>;
export const AdminCoursePatchSchema = AdminCourseBodySchema.partial().openapi("AdminCoursePatch");
export type AdminCoursePatch = z.infer<typeof AdminCoursePatchSchema>;
export const AdminChapterBodySchema = z.object({ title: CourseTitle }).openapi("AdminChapterBody");
export const AdminChapterPatchSchema = z
  .object({ title: CourseTitle.optional(), sortOrder: z.number().int().optional() })
  .openapi("AdminChapterPatch");
export type AdminChapterPatch = z.infer<typeof AdminChapterPatchSchema>;
export const AdminLessonBodySchema = z
  .object({
    title: CourseTitle,
    /** 所属章；不传 / null 为无章 */
    chapterId: z.string().nullable().optional(),
    freePreview: z.boolean().optional(),
  })
  .openapi("AdminLessonBody");
export type AdminLessonBody = z.infer<typeof AdminLessonBodySchema>;
export const AdminLessonPatchSchema = z
  .object({
    title: CourseTitle.optional(),
    chapterId: z.string().nullable().optional(),
    sortOrder: z.number().int().optional(),
    freePreview: z.boolean().optional(),
    /** 直传完成后回写的 VOD FileId；写入即置 `videoStatus = PROCESSING` */
    videoFileId: z.string().min(1).optional(),
  })
  .openapi("AdminLessonPatch");
export type AdminLessonPatch = z.infer<typeof AdminLessonPatchSchema>;
/** 一次性写整门课的章顺序与课时归属 / 顺序；必须覆盖该课全部课时 */
export const AdminLessonOrderBodySchema = z
  .object({
    chapters: z.array(z.object({ id: z.string(), lessonIds: z.array(z.string()) })),
    unchaptered: z.array(z.string()),
  })
  .openapi("AdminLessonOrderBody");
export type AdminLessonOrderBody = z.infer<typeof AdminLessonOrderBodySchema>;
export const UploadSignatureSchema = z
  .object({
    /** 腾讯云 VOD 客户端上传签名（mock 下为 "mock-upload"） */
    signature: z.string(),
    expiresAt: z.string().datetime(),
  })
  .openapi("UploadSignature");

// ── 按课授权 ──
export const adminCourseStudentQuerySchema = z.object(pageQuery);
export const AdminCourseStudentSchema = z
  .object({
    userId: z.string(),
    name: z.string(),
    phone: z.string().nullable(),
    grantedAt: z.string().datetime(),
    expiresAt: NullableDateTime,
    /** 已完成课时占比 0–100；没有任何进度时为 null */
    progressPercent: z.number().int().nullable(),
    /** 最近一次写进度的时间；没有进度时为 null */
    lastActiveAt: NullableDateTime,
  })
  .openapi("AdminCourseStudent");
export type AdminCourseStudent = z.infer<typeof AdminCourseStudentSchema>;
export const AdminCourseStudentListSchema = paged(AdminCourseStudentSchema, "AdminCourseStudentList");
/** 批量开通，幂等：已有的授权只更新 `expiresAt`（传了才更新） */
export const AdminCourseGrantBodySchema = z
  .object({ userIds: z.array(z.string().min(1)).min(1).max(500), expiresAt: NullableDateTime.optional() })
  .openapi("AdminCourseGrantBody");
export type AdminCourseGrantBody = z.infer<typeof AdminCourseGrantBodySchema>;

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
