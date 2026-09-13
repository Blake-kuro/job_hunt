import type { components, paths } from "./schema";

type S = components["schemas"];

export type ApiErrorBody = S["ApiError"];
export type ApiErrorCode = S["ApiErrorCode"];
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
/**
 * 后端对 `QuizToday.question` 用 `QuizQuestionPublicSchema.nullable()`，但 @hono/zod-openapi
 * 把这个 nullable 烘焙进了被引用的组件本身（`components.schemas.QuizQuestionPublic` 的
 * `type` 变成 `["object","null"]`），而不是只在引用处加 nullable。这样生成的
 * `S["QuizQuestionPublic"]` 会带 `| null`，而组件层（QuizQuestion.tsx）的 props 一直按
 * "非空" 使用（调用方在渲染前已判空）。这里剥掉 null，保持字段级类型与组件层预期一致；
 * `QuizToday` 不受影响 —— 它的 `question` 字段本就该是 `QuizQuestionPublic | null`。
 */
export type QuizQuestionPublic = NonNullable<S["QuizQuestionPublic"]>;
export type QuizToday = S["QuizToday"];
export type QuizAnswerResult = S["QuizAnswerResult"];
export type WrongBookItem = S["WrongBookItem"];
export type QuizDashboard = S["QuizDashboard"];
export type CompanySetItem = S["CompanySetItem"];
