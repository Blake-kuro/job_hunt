import { createMiddleware } from "hono/factory";
import { prisma } from "./db";
import type { Env } from "./env";

export const DEV_USER_EMAIL = "dev@local";

/** 当前用户 id。现在固定返回种子开发账号；接入登录时只改 requestUser。 */
export async function getCurrentUserId(): Promise<string> {
  const user = await prisma.user.findUnique({ where: { email: DEV_USER_EMAIL }, select: { id: true } });
  if (!user) throw new Error(`种子用户 ${DEV_USER_EMAIL} 不存在，先运行 pnpm db:seed`);
  return user.id;
}

/** 每请求把 userId 放进 c.var */
export const requestUser = createMiddleware<Env>(async (c, next) => {
  c.set("userId", await getCurrentUserId());
  await next();
});
