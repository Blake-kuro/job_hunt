import type { components, operations, paths } from "./schema";

type S = components["schemas"];

// 通用
export type ApiErrorBody = S["ApiError"];
export type ApiErrorCode = S["ApiErrorCode"];
export type User = S["User"];
export type Tier = S["Tier"];
export type Plan = S["Plan"];
export type Access = S["Access"];
export type SendSmsResult = S["SendSmsResult"];
export type CategoryId = S["CategoryId"];
export type ContentType = S["ContentType"];
export type IdResult = S["IdResult"];
export type IntIdResult = S["IntIdResult"];

// 学生端：岗位
export type ApplicationStatus = S["ApplicationStatus"];
/**
 * 后端 `jobListQuerySchema` 只在 GET /api/jobs 的 query 参数里使用（未作为 request/response
 * body），`@hono/zod-openapi` 不会把它提升为 components.schemas.JobListQuery —— 生成的
 * schema.d.ts 里没有这个 key，只有内联的 `paths["/api/jobs"]["get"]["parameters"]["query"]`。
 * 从那里取类型，再套用 sort/page/pageSize 的 Required 修正，使其与 validateSearch（-search.ts）
 * 产出的类型结构一致。
 */
type JobListQueryRaw = NonNullable<paths["/api/jobs"]["get"]["parameters"]["query"]>;
export type JobListQuery = Required<Pick<JobListQueryRaw, "sort" | "page" | "pageSize">> &
  Omit<JobListQueryRaw, "sort" | "page" | "pageSize">;
export type JobListItem = S["JobListItem"];
export type JobListResult = S["JobListResult"];
export type JobProgress = S["JobProgress"];

// 刷题（学生端 / 小程序共用的公开题型）
export type QuestionType = S["QuestionType"];
export type Difficulty = S["Difficulty"];
export type QuizOptionLetter = S["QuizOptionLetter"];
export type QuizOption = S["QuizOption"];
export type QuizQuestionPublic = S["QuizQuestionPublic"];
export type QuizNext = S["QuizNext"];
export type QuizBanks = S["QuizBanks"];
export type QuizQuota = S["QuizQuota"];
export type QuizAnswerResult = S["QuizAnswerResult"];
export type WrongBookItem = S["WrongBookItem"];
export type QuizDashboard = S["QuizDashboard"];

// 管理端
export type AdminSummary = S["AdminSummary"];
export type AdminStudent = S["AdminStudent"];
export type AdminGrant = S["AdminGrant"];
export type AdminStudentList = S["AdminStudentList"];
export type AdminStudentPatch = S["AdminStudentPatch"];
export type AdminAccessBody = S["AdminAccessBody"];
export type AdminMaterial = S["AdminMaterial"];
export type AdminCourse = S["AdminCourse"];
export type AdminCourseLesson = S["AdminCourseLesson"];
export type AdminContentBody = S["AdminContentBody"];
export type AdminMaterialBody = S["AdminMaterialBody"];
export type AdminCourseBody = S["AdminCourseBody"];
export type AdminQuizMeta = S["AdminQuizMeta"];
export type AdminQuestion = S["AdminQuestion"];
export type AdminQuestionList = S["AdminQuestionList"];
export type AdminQuestionBody = S["AdminQuestionBody"];
export type AdminQuestionPatch = S["AdminQuestionPatch"];
export type AdminCompany = S["AdminCompany"];
export type AdminCompanyBody = S["AdminCompanyBody"];
export type AdminCompanyPatch = S["AdminCompanyPatch"];
export type AdminCategory = S["AdminCategory"];
export type AdminCategoryBody = S["AdminCategoryBody"];
export type AdminCategoryPatch = S["AdminCategoryPatch"];
export type AdminQuestionImportResult = S["AdminQuestionImportResult"];
export type AdminJob = S["AdminJob"];
export type AdminJobList = S["AdminJobList"];
export type AdminJobBody = S["AdminJobBody"];
export type AdminJobPatch = S["AdminJobPatch"];
export type AdminImportResult = S["AdminImportResult"];

/** 列表接口的 query 参数（后端只在 query 里用，不会提升为 components.schemas） */
export type StudentsQuery = NonNullable<operations["listAdminStudents"]["parameters"]["query"]>;
export type QuestionsQuery = NonNullable<operations["listAdminQuestions"]["parameters"]["query"]>;
export type JobsQuery = NonNullable<operations["listAdminJobs"]["parameters"]["query"]>;
