import type { Access } from "@api/types";

/** 与后端 LIMITS.FREE 一致（双份维护：后端 src/lib/access.ts） */
export const FREE_LIMITS = { jobs: 100, questions: 200 } as const;

export type AccessKind = "jobs" | "questions";

export interface AccessMessage {
  title: string;
  body: string;
  action: { label: string; to: "/login" | "/pro" };
}

const NOUN: Record<AccessKind, { unit: string; thing: string; verb: string }> = {
  jobs: { unit: "条", thing: "岗位", verb: "查看" },
  questions: { unit: "道", thing: "题", verb: "练习" },
};

export function accessMessage(access: Access, kind: AccessKind): AccessMessage | null {
  if (access.visible === null || access.total <= access.visible) return null;
  const n = NOUN[kind];
  if (access.tier === "GUEST") {
    return {
      title: `未登录只能${n.verb}前 ${access.visible} ${n.unit}${n.thing}`,
      body: `登录后可${n.verb}前 ${FREE_LIMITS[kind]} ${n.unit}，共 ${access.total} ${n.unit}。`,
      action: { label: "登录", to: "/login" },
    };
  }
  if (access.tier === "FREE") {
    return {
      title: `免费账号可${n.verb}前 ${access.visible} ${n.unit}${n.thing}`,
      body: `升级 PRO 解锁全部 ${access.total} ${n.unit}。`,
      action: { label: "了解 PRO", to: "/pro" },
    };
  }
  return null;
}
