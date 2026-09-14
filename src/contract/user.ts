import { z } from "@hono/zod-openapi";
import { PlanSchema, TierSchema } from "./access";

export const UserSchema = z
  .object({
    id: z.string(),
    email: z.string().nullable(),
    phone: z.string().nullable(),
    name: z.string(),
    tier: TierSchema,
    plan: PlanSchema,
    proExpiresAt: z.string().nullable(),
    role: z.enum(["STUDENT", "ADMIN"]),
    enabled: z.boolean(),
  })
  .openapi("User");
export type User = z.infer<typeof UserSchema>;
