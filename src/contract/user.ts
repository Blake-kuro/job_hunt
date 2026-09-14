import { z } from "@hono/zod-openapi";

export const UserSchema = z
  .object({ id: z.string(), email: z.string().nullable(), phone: z.string().nullable(), name: z.string() })
  .openapi("User");
export type User = z.infer<typeof UserSchema>;
