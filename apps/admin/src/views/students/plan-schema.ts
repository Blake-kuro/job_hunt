import type { AdminStudent, AdminStudentPatch } from "@job-hunt/api-client/types";
import { z } from "zod";

/** 档位对话框：FREE / PRO；PRO 可选到期日（"" = 永久） */
export const schema = z.object({
  plan: z.enum(["FREE", "PRO"]),
  proExpiresAt: z.string(),
});

export type FormValues = z.infer<typeof schema>;

export const defaultValues: FormValues = { plan: "FREE", proExpiresAt: "" };

export function fromEntity(s: Pick<AdminStudent, "plan" | "proExpiresAt">): FormValues {
  return { plan: s.plan, proExpiresAt: s.proExpiresAt?.slice(0, 10) ?? "" };
}

/** FREE 或到期日留空 → proExpiresAt: null；PRO 有日期按 UTC 零点发送 */
export function toBody(v: FormValues): AdminStudentPatch {
  return {
    plan: v.plan,
    proExpiresAt: v.plan === "PRO" && v.proExpiresAt ? `${v.proExpiresAt}T00:00:00.000Z` : null,
  };
}
