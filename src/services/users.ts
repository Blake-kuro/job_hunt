import type { User } from "../contract";
import { prisma } from "../db";

export async function getCurrentUser(userId: string): Promise<User> {
  return prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { id: true, email: true, name: true } });
}
