import "server-only";
import { cache } from "react";
import { prisma } from "./db";

export const DEV_USER_EMAIL = "dev@local";

/**
 * 当前用户 id。现在固定返回种子开发账号；接入登录时只改这个函数。
 * React.cache：同一次请求内多处调用只查一次库。
 */
export const getCurrentUserId = cache(async (): Promise<string> => {
  const user = await prisma.user.findUnique({ where: { email: DEV_USER_EMAIL }, select: { id: true } });
  if (!user) throw new Error(`种子用户 ${DEV_USER_EMAIL} 不存在，先运行 npm run db:seed`);
  return user.id;
});
