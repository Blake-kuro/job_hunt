import type { AdminAccessBody, AdminGrant, ContentType } from "@api/types";

/** 授权对话框里的一行；expiresAt 为 "" 或 "YYYY-MM-DD"（对应 <input type="date">） */
export interface GrantRow {
  contentType: ContentType;
  contentId: string;
  contentTitle: string | null;
  expiresAt: string;
}

/** 后端返回的授权 → 行编辑器初值：ISO 时间取前 10 位 */
export function fromGrants(grants: AdminGrant[]): GrantRow[] {
  return grants.map((g) => ({
    contentType: g.contentType,
    contentId: g.contentId,
    contentTitle: g.contentTitle,
    expiresAt: g.expiresAt ? g.expiresAt.slice(0, 10) : "",
  }));
}

/** 行编辑器 → PUT body：丢掉 contentId 为空白的行；日期按 UTC 零点发送（后端不接受带偏移的字符串） */
export function toAccessBody(rows: GrantRow[]): AdminAccessBody {
  return {
    grants: rows
      .filter((r) => r.contentId.trim() !== "")
      .map((r) => ({
        contentType: r.contentType,
        contentId: r.contentId.trim(),
        expiresAt: r.expiresAt ? `${r.expiresAt}T00:00:00.000Z` : null,
      })),
  };
}
