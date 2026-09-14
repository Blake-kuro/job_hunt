import type { User } from "../contract";
import { prisma } from "../db";
import { type Access, accessFor, resolveTier } from "../lib/access";

const userSelect = {
  id: true,
  email: true,
  name: true,
  plan: true,
  proExpiresAt: true,
  role: true,
  enabled: true,
  identities: { select: { provider: true, providerKey: true } },
} as const;

type UserRow = {
  id: string;
  email: string | null;
  name: string;
  plan: "FREE" | "PRO";
  proExpiresAt: Date | null;
  role: "STUDENT" | "ADMIN";
  enabled: boolean;
  identities: { provider: string; providerKey: string }[];
};

function toAccess(row: UserRow): Access {
  return accessFor(
    resolveTier({
      plan: row.plan,
      proExpiresAt: row.proExpiresAt,
      hasPhone: row.identities.some((i) => i.provider === "PHONE"),
    }),
  );
}

export async function getAccess(userId: string): Promise<Access> {
  const row = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: userSelect });
  return toAccess(row);
}

export async function getCurrentUser(userId: string): Promise<User> {
  const row = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: userSelect });
  return {
    id: row.id,
    email: row.email,
    phone: row.identities.find((i) => i.provider === "PHONE")?.providerKey ?? null,
    name: row.name,
    tier: toAccess(row).tier,
    plan: row.plan,
    proExpiresAt: row.proExpiresAt ? row.proExpiresAt.toISOString() : null,
    role: row.role,
    enabled: row.enabled,
  };
}
