import type { Plan } from "../generated/prisma/enums";

export type Tier = "GUEST" | "FREE" | "PRO";

export interface Access {
  tier: Tier;
  /** 岗位可见条数；null = 无限制 */
  jobs: number | null;
  /** 题库可见道数；null = 无限制 */
  questions: number | null;
}

export const LIMITS: Record<Tier, { jobs: number | null; questions: number | null }> = {
  GUEST: { jobs: 20, questions: 20 },
  FREE: { jobs: 100, questions: 200 },
  PRO: { jobs: null, questions: null },
};

export function resolveTier(
  u: { plan: Plan; proExpiresAt: Date | null; hasPhone: boolean },
  now: Date = new Date(),
): Tier {
  if (u.plan === "PRO" && (u.proExpiresAt === null || u.proExpiresAt > now)) return "PRO";
  return u.hasPhone ? "FREE" : "GUEST";
}

export function accessFor(tier: Tier): Access {
  return { tier, ...LIMITS[tier] };
}
