import { z } from "@hono/zod-openapi";

export const UserSchema = z.object({ id: z.string(), email: z.string(), name: z.string() }).openapi("User");
export type User = z.infer<typeof UserSchema>;
