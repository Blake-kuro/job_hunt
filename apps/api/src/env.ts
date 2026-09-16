import type { Access } from "./lib/access";

/** Hono 泛型：中间件注入的每请求变量 */
export type Env = { Variables: { userId: string; access: Access; role: "STUDENT" | "ADMIN" } };
