import type { components, operations } from "./schema";

type S = components["schemas"];

export type ApiErrorBody = S["ApiError"];
export type ApiErrorCode = S["ApiErrorCode"];
export type User = S["User"];
export type Tier = S["Tier"];
export type Plan = S["Plan"];
export type SendSmsResult = S["SendSmsResult"];
export type ContentType = S["ContentType"];
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
export type AdminCategory = S["AdminCategory"];
export type AdminCategoryBody = S["AdminCategoryBody"];
export type QuestionType = S["QuestionType"];
export type AdminCompanyBody = S["AdminCompanyBody"];
export type QuizOption = S["QuizOption"];
export type QuizOptionLetter = S["QuizOptionLetter"];
export type Difficulty = S["Difficulty"];
export type CategoryId = S["CategoryId"];
export type AdminJob = S["AdminJob"];
export type AdminJobList = S["AdminJobList"];
export type AdminJobBody = S["AdminJobBody"];
export type AdminJobPatch = S["AdminJobPatch"];
export type AdminImportResult = S["AdminImportResult"];
export type IdResult = S["IdResult"];
export type IntIdResult = S["IntIdResult"];

/** 列表接口的 query 参数（后端只在 query 里用，不会提升为 components.schemas） */
export type StudentsQuery = NonNullable<operations["listAdminStudents"]["parameters"]["query"]>;
export type QuestionsQuery = NonNullable<operations["listAdminQuestions"]["parameters"]["query"]>;
export type JobsQuery = NonNullable<operations["listAdminJobs"]["parameters"]["query"]>;
