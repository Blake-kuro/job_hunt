import type { components, paths } from "./schema";

type S = components["schemas"];

export type ApiErrorBody = S["ApiError"];
export type ApiErrorCode = S["ApiErrorCode"];
export type User = S["User"];
export type SendSmsResult = S["SendSmsResult"];
export type CategoryId = S["CategoryId"];
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
export type QuizOptionLetter = S["QuizOptionLetter"];
export type QuizOption = S["QuizOption"];
export type QuizQuestionPublic = S["QuizQuestionPublic"];
export type QuizToday = S["QuizToday"];
export type QuizAnswerResult = S["QuizAnswerResult"];
export type WrongBookItem = S["WrongBookItem"];
export type QuizDashboard = S["QuizDashboard"];
export type CompanySetItem = S["CompanySetItem"];
