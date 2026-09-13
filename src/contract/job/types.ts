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
