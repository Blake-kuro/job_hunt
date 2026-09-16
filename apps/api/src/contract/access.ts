import { z } from "@hono/zod-openapi";

export const TierSchema = z.enum(["GUEST", "FREE", "PRO"]).openapi("Tier");
export type TierValue = z.infer<typeof TierSchema>;
export const PlanSchema = z.enum(["FREE", "PRO"]).openapi("Plan");

/** 当前档位对某类资源的可见范围 */
export const AccessSchema = z
  .object({
    tier: TierSchema,
    visible: z.number().int().nullable(),
    total: z.number().int(),
  })
  .openapi("Access");
export type AccessInfo = z.infer<typeof AccessSchema>;
