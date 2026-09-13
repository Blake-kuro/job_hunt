import { prisma } from "../db";

export async function getCurrentUser(userId: string): Promise<{ id: string; email: string; name: string }> {
  return prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { id: true, email: true, name: true } });
}
