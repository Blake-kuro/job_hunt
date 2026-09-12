import type { Job } from "@/generated/prisma/client";
import type { AppStatus } from "@/generated/prisma/enums";
import { CATEGORY, isCategoryId, type JobListItem } from "@entities/job";
import { dateKey, daysBetween } from "./dates";
import { splitMulti } from "./parse";

export type JobRowWithUserState = Job & {
  favorites: { userId: string }[];
  applications: { status: AppStatus }[];
};

export function toJobListItem(row: JobRowWithUserState, todayKey: string): JobListItem {
  const category = isCategoryId(row.categoryId) ? row.categoryId : 1;
  const deadlineAt = row.deadlineAt ? row.deadlineAt.toISOString().slice(0, 10) : null;
  return {
    id: row.id,
    company: row.enterpriseName,
    category,
    categoryLabel: CATEGORY[category],
    positions: splitMulti(row.position),
    cities: splitMulti(row.workLocation),
    degree: row.degree,
    industry: row.industry,
    batch: row.recruitmentBatch,
    graduationYear: row.graduationYear,
    deadlineText: row.deadline,
    deadlineAt,
    daysLeft: deadlineAt ? daysBetween(todayKey, deadlineAt) : null,
    postedAt: dateKey(row.createTime),
    announcementLink: row.announcementLink,
    deliveryAddress: row.deliveryAddress,
    starred: row.favorites.length > 0,
    applicationStatus: row.applications[0]?.status ?? null,
  };
}
