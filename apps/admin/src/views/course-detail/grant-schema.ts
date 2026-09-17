import type { AdminCourseGrantBody } from "@job-hunt/api-client/types";
import { z } from "zod";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** 多行 / 逗号 / 空格分隔的手机号 → 去重后的列表（保持首次出现顺序） */
export function parsePhones(text: string): string[] {
  const seen = new Set<string>();
  for (const raw of text.split(/[\s,，;；]+/)) {
    const p = raw.trim();
    if (p && !seen.has(p)) seen.add(p);
  }
  return [...seen];
}

export const schema = z.object({
  phones: z
    .string()
    .refine((v) => parsePhones(v).length > 0, "请至少填写一个手机号")
    .refine((v) => parsePhones(v).length <= 500, "一次最多开通 500 人"),
  expiresAt: z
    .string()
    .trim()
    .refine((v) => v === "" || DATE_RE.test(v), "到期日期格式为 YYYY-MM-DD"),
});

export type FormValues = z.infer<typeof schema>;

export const defaultValues: FormValues = { phones: "", expiresAt: "" };

/** userIds 由调用方按手机号查出后传入；到期留空 = 永久（不发 expiresAt，不动已有到期） */
export function toBody(userIds: string[], v: FormValues): AdminCourseGrantBody {
  const expiresAt = v.expiresAt.trim();
  return expiresAt ? { userIds, expiresAt: `${expiresAt}T00:00:00.000Z` } : { userIds };
}
