export type JobKind = "实习" | "校招";

export type JobStatus = "未投递" | "已投递" | "面试中" | "已截止";

export interface Job {
  id: string;
  company: string;
  role: string;
  city: string;
  type: JobKind;
  degree: string;
  deadline: string;
  posted: string;
  status: JobStatus;
  daysLeft: number;
  referral: boolean;
  starred: boolean;
}
