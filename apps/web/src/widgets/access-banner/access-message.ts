import type { Access, QuizQuota } from "@api/types";

/** 与后端 LIMITS.FREE 一致（双份维护：后端 src/lib/access.ts） */
export const FREE_LIMITS = { jobs: 100, questions: 200 } as const;

export type AccessInput = { kind: "jobs"; access: Access } | { kind: "questions"; quota: QuizQuota };

export interface AccessMessage {
  title: string;
  body: string;
  action: { label: string; to: "/login" | "/pro" };
}

const LOGIN = { label: "登录", to: "/login" } as const;
const PRO = { label: "了解 PRO", to: "/pro" } as const;

function jobsMessage(access: Access): AccessMessage | null {
  if (access.visible === null || access.total <= access.visible) return null;
  if (access.tier === "GUEST") {
    return {
      title: `未登录只能查看前 ${access.visible} 条岗位`,
      body: `登录后可查看前 ${FREE_LIMITS.jobs} 条，共 ${access.total} 条。`,
      action: LOGIN,
    };
  }
  if (access.tier === "FREE") {
    return {
      title: `免费账号可查看前 ${access.visible} 条岗位`,
      body: `升级 PRO 解锁全部 ${access.total} 条。`,
      action: PRO,
    };
  }
  return null;
}

/** 作答配额：累计可作答的不同题数，用尽后才提示。 */
function questionsMessage(quota: QuizQuota): AccessMessage | null {
  if (quota.limit === null || quota.used < quota.limit) return null;
  if (quota.tier === "GUEST") {
    return {
      title: `未登录只能作答 ${quota.limit} 道题`,
      body: `已用完 ${quota.limit} 道，登录后可作答 ${FREE_LIMITS.questions} 道。`,
      action: LOGIN,
    };
  }
  if (quota.tier === "FREE") {
    return {
      title: `免费账号可作答 ${quota.limit} 道题`,
      body: "已用完，升级 PRO 不限次数。",
      action: PRO,
    };
  }
  return null;
}

export function accessMessage(input: AccessInput): AccessMessage | null {
  return input.kind === "jobs" ? jobsMessage(input.access) : questionsMessage(input.quota);
}
