import { z } from "zod";

/** 与后端 contract 的 jobListQuerySchema 同步；只用于 validateSearch */
export const jobListSearchSchema = z.object({
  category: z.coerce
    .number()
    .pipe(z.union([z.literal(1), z.literal(2), z.literal(3)]))
    .optional(),
  city: z.string().trim().min(1).optional(),
  q: z.string().trim().min(1).optional(),
  sort: z.enum(["deadline", "posted"]).default("deadline"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
