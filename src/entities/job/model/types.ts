import type { CategoryId } from "./category";

export type ApplicationStatus = "APPLIED" | "INTERVIEWING";

export interface JobListItem {
  id: number;
  company: string;
  category: CategoryId;
  categoryLabel: string;
  positions: string[];
  cities: string[];
  degree: string | null;
  industry: string | null;
  batch: string | null;
  graduationYear: string | null;
  deadlineText: string | null;
  deadlineAt: string | null;
  daysLeft: number | null;
  postedAt: string;
  announcementLink: string | null;
  deliveryAddress: string | null;
  starred: boolean;
  applicationStatus: ApplicationStatus | null;
}

export interface JobListResult {
  items: JobListItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface JobProgress {
  starred: number;
  applied: number;
  interviewing: number;
  newThisWeek: number;
  newInternshipsThisWeek: number;
  nextDeadline: { jobId: number; company: string; daysLeft: number } | null;
}

export function isExpired(item: Pick<JobListItem, "daysLeft">): boolean {
  return item.daysLeft !== null && item.daysLeft < 0;
}

export function statusLabel(status: ApplicationStatus | null, expired: boolean): string {
  if (status === "APPLIED") return "已投递";
  if (status === "INTERVIEWING") return "面试中";
  return expired ? "已截止" : "未投递";
}

export function statusVariant(status: ApplicationStatus | null, expired: boolean): "accent" | "neutral" | "outline" {
  if (status === "APPLIED") return "accent";
  if (status === "INTERVIEWING") return "outline";
  return "neutral";
}
