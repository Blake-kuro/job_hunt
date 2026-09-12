import type { Job, JobStatus } from "../model/types";

export const statusVariant: Record<JobStatus, "accent" | "neutral" | "outline"> = {
  未投递: "neutral",
  已投递: "accent",
  面试中: "outline",
  已截止: "neutral",
};

export function deadlineNote(job: Job): { text: string; urgent: boolean } {
  if (job.daysLeft < 0) return { text: "已结束", urgent: false };
  return { text: `剩 ${job.daysLeft} 天`, urgent: job.daysLeft <= 10 };
}

export function actionLabel(status: JobStatus): string {
  return status === "已投递" || status === "面试中" ? "已投递" : "标记已投";
}
