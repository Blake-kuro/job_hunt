import { z } from "zod";

export const jobListQuerySchema = z.object({
  category: z.coerce.number().pipe(z.union([z.literal(1), z.literal(2), z.literal(3)])).optional(),
  city: z.string().trim().min(1).optional(),
  q: z.string().trim().min(1).optional(),
  sort: z.enum(["deadline", "posted"]).default("deadline"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type JobListQuery = z.infer<typeof jobListQuerySchema>;

/** 把 URL searchParams（值可能是 string[]）压成 schema 能吃的形状；"all" 与空串视为未设置 */
export function parseJobListQuery(raw: Record<string, string | string[] | undefined>): JobListQuery {
  const flat: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    const s = Array.isArray(v) ? v[0] : v;
    if (s === undefined || s === "" || s === "all") continue;
    flat[k] = s;
  }
  const r = jobListQuerySchema.safeParse(flat);
  return r.success ? r.data : jobListQuerySchema.parse({});
}
