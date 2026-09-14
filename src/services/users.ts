import type { User } from "../contract";
import { prisma } from "../db";

export async function getCurrentUser(userId: string): Promise<User> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      identities: { where: { provider: "PHONE" }, select: { providerKey: true }, take: 1 },
    },
  });
  return { id: user.id, email: user.email, phone: user.identities[0]?.providerKey ?? null, name: user.name };
}
