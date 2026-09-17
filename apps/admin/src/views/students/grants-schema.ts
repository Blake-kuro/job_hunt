import type { AdminAccessBody, AdminGrant } from "@job-hunt/api-client/types";
import { z } from "zod";

/** 授权对话框：一行一条授权；expiresAt 为 "" 或 "YYYY-MM-DD"（对应 <input type="date">） */
export const schema = z.object({
  grants: z.array(
    z.object({
      contentType: z.enum(["MATERIAL", "QUESTION", "COURSE"]),
      contentId: z.string().trim(),
      /** 只用于展示（题目保存后才有题干） */
      contentTitle: z.string().nullable(),
      expiresAt: z.string(),
    }),
  ),
});

export type FormValues = z.infer<typeof schema>;
export type GrantRow = FormValues["grants"][number];

export const emptyRow: GrantRow = { contentType: "MATERIAL", contentId: "", contentTitle: null, expiresAt: "" };

export const defaultValues: FormValues = { grants: [] };

/** 后端返回的授权 → 行编辑器初值：ISO 时间取前 10 位 */
export function fromEntity(grants: AdminGrant[]): FormValues {
  return {
    grants: grants.map((g) => ({
      contentType: g.contentType,
      contentId: g.contentId,
      contentTitle: g.contentTitle,
      expiresAt: g.expiresAt ? g.expiresAt.slice(0, 10) : "",
    })),
  };
}

/** 行编辑器 → PUT body：丢掉 contentId 为空白的行；日期按 UTC 零点发送（后端不接受带偏移的字符串） */
export function toBody(v: FormValues): AdminAccessBody {
  return {
    grants: v.grants
      .filter((r) => r.contentId.trim() !== "")
      .map((r) => ({
        contentType: r.contentType,
        contentId: r.contentId.trim(),
        expiresAt: r.expiresAt ? `${r.expiresAt}T00:00:00.000Z` : null,
      })),
  };
}
