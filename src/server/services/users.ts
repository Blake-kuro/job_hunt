import "server-only";
import { prisma } from "@/server/db";
import { getCurrentUserId } from "@/server/auth";

export async function getCurrentUser(): Promise<{ id: string; email: string; name: string }> {
  const id = await getCurrentUserId();
  const user = await prisma.user.findUniqueOrThrow({ where: { id }, select: { id: true, email: true, name: true } });
  return user;
}
