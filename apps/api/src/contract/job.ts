import { z } from "@hono/zod-openapi";
import { AccessSchema } from "./access";

export const CategoryIdSchema = z.union([z.literal(1), z.literal(2), z.literal(3)]).openapi("CategoryId");
export type CategoryId = z.infer<typeof CategoryIdSchema>;

export const CATEGORY: Record<CategoryId, string> = { 1: "秋招与实习", 2: "央国企", 3: "外企" };

export const CATEGORY_OPTIONS = [
  { value: "all", label: "全部" },
  { value: "1", label: CATEGORY[1] },
  { value: "2", label: CATEGORY[2] },
  { value: "3", label: CATEGORY[3] },
] as const;

export function isCategoryId(n: number): n is CategoryId {
  return n === 1 || n === 2 || n === 3;
}

export const jobListQuerySchema = z.object({
  category: z.coerce
    .number()
    .pipe(CategoryIdSchema)
    .optional()
    .openapi({ type: "integer", enum: [1, 2, 3] }),
  city: z.string().trim().min(1).optional(),
  q: z.string().trim().min(1).optional(),
  sort: z.enum(["deadline", "posted"]).default("deadline"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type JobListQuery = z.infer<typeof jobListQuerySchema>;

export const ApplicationStatusSchema = z.enum(["APPLIED", "INTERVIEWING"]).openapi("ApplicationStatus");
export type ApplicationStatus = z.infer<typeof ApplicationStatusSchema>;

export const JobListItemSchema = z
  .object({
    id: z.number().int(),
    company: z.string(),
    category: CategoryIdSchema,
    categoryLabel: z.string(),
    positions: z.array(z.string()),
    cities: z.array(z.string()),
    degree: z.string().nullable(),
    industry: z.string().nullable(),
    batch: z.string().nullable(),
    graduationYear: z.string().nullable(),
    deadlineText: z.string().nullable(),
    deadlineAt: z.string().nullable(),
    daysLeft: z.number().int().nullable(),
    postedAt: z.string(),
    announcementLink: z.string().nullable(),
    deliveryAddress: z.string().nullable(),
    starred: z.boolean(),
    applicationStatus: z.union([ApplicationStatusSchema, z.null()]),
  })
  .openapi("JobListItem");
export type JobListItem = z.infer<typeof JobListItemSchema>;

export const JobListResultSchema = z
  .object({
    items: z.array(JobListItemSchema),
    total: z.number().int(),
    page: z.number().int(),
    pageSize: z.number().int(),
    access: AccessSchema,
  })
  .openapi("JobListResult");
export type JobListResult = z.infer<typeof JobListResultSchema>;

export const JobProgressSchema = z
  .object({
    starred: z.number().int(),
    applied: z.number().int(),
    interviewing: z.number().int(),
    newThisWeek: z.number().int(),
    newInternshipsThisWeek: z.number().int(),
    nextDeadline: z.object({ jobId: z.number().int(), company: z.string(), daysLeft: z.number().int() }).nullable(),
  })
  .openapi("JobProgress");
export type JobProgress = z.infer<typeof JobProgressSchema>;

export const IdParamSchema = z.object({
  id: z.coerce
    .number()
    .int()
    .positive()
    .openapi({ param: { name: "id", in: "path" }, example: 1 }),
});
export const ApplicationBodySchema = z.object({ status: ApplicationStatusSchema }).openapi("ApplicationBody");
export const FavoriteResultSchema = z.object({ starred: z.boolean() }).openapi("FavoriteResult");
export const ApplicationResultSchema = z
  .object({ applicationStatus: z.union([ApplicationStatusSchema, z.null()]) })
  .openapi("ApplicationResult");
