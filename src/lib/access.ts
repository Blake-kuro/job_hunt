import { prisma } from "../db";
import type { Plan } from "../generated/prisma/enums";
import { AppError } from "./errors";

export type Tier = "GUEST" | "FREE" | "PRO";

export interface Access {
  tier: Tier;
  /** 岗位可见条数；null = 无限制 */
  jobs: number | null;
  /** 累计可作答的不同题数上限（全站共通）；null = 无限制 */
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

// ── 刷题配额：按该用户作答过的不同题数计，重复作答同一题不计 ──

export type Role = "STUDENT" | "ADMIN";
export interface QuestionQuota {
  tier: Tier;
  limit: number | null;
  used: number;
}

export async function usedQuestionQuota(userId: string): Promise<number> {
  const rows = await prisma.attempt.findMany({
    where: { userId },
    select: { questionId: true },
    distinct: ["questionId"],
  });
  return rows.length;
}

export function quotaOf(access: Access, role: Role, used: number): QuestionQuota {
  return { tier: access.tier, limit: role === "ADMIN" ? null : access.questions, used };
}

export function quotaExhausted(q: { limit: number | null; used: number }): boolean {
  return q.limit !== null && q.used >= q.limit;
}

/** 配额已用尽 → 403（调用方负责只在"作答新题"时调用） */
export async function assertQuestionQuota(userId: string, access: Access, role: Role): Promise<QuestionQuota> {
  const quota = quotaOf(access, role, await usedQuestionQuota(userId));
  if (quotaExhausted(quota)) throw new AppError(403, "FORBIDDEN", "作答次数已用完，登录或升级后继续");
  return quota;
}
