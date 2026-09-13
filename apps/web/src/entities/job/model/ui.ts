import type { ApplicationStatus, JobListItem } from "@api/types";

export function isExpired(item: Pick<JobListItem, "daysLeft">): boolean {
  return item.daysLeft !== null && item.daysLeft < 0;
}

export function statusLabel(status: ApplicationStatus | null, expired: boolean): string {
  if (status === "APPLIED") return "已投递";
  if (status === "INTERVIEWING") return "面试中";
  return expired ? "已截止" : "未投递";
}

export function statusVariant(status: ApplicationStatus | null, _expired: boolean): "accent" | "neutral" | "outline" {
  if (status === "APPLIED") return "accent";
  if (status === "INTERVIEWING") return "outline";
  return "neutral";
}
