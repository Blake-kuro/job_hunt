import type { JobListQuery, JobListResult, JobProgress } from "@job-hunt/shared";
import { prisma } from "../db";
import type { Prisma } from "../generated/prisma/client";
import type { AppStatus } from "../generated/prisma/enums";
import { dateKey, daysBetween, dbDateToKey, keyToDate, keyToInstant, weekStartKey } from "../lib/dates";
import { NotFoundError } from "../lib/errors";
import { toJobListItem } from "../lib/job-dto";

const userState = (userId: string) => ({
  favorites: { where: { userId }, select: { userId: true } },
  applications: { where: { userId }, select: { status: true } },
});

export async function listJobs(query: JobListQuery, userId: string): Promise<JobListResult> {
  const where: Prisma.JobWhereInput = {
    ...(query.category && { categoryId: query.category }),
    ...(query.city && { workLocation: { contains: query.city } }),
    ...(query.q && {
      OR: [
        { enterpriseName: { contains: query.q, mode: "insensitive" } },
        { position: { contains: query.q, mode: "insensitive" } },
        { industry: { contains: query.q, mode: "insensitive" } },
      ],
    }),
  };

  const orderBy: Prisma.JobOrderByWithRelationInput[] =
    query.sort === "posted"
      ? [{ createTime: "desc" }]
      : [{ deadlineAt: { sort: "asc", nulls: "last" } }, { createTime: "desc" }];

  const [rows, total] = await Promise.all([
    prisma.job.findMany({
      where,
      orderBy,
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include: userState(userId),
    }),
    prisma.job.count({ where }),
  ]);

  const today = dateKey();
  return {
    items: rows.map((r) => toJobListItem(r, today)),
    total,
    page: query.page,
    pageSize: query.pageSize,
  };
}

async function assertJobExists(jobId: number) {
  const exists = await prisma.job.findUnique({ where: { id: jobId }, select: { id: true } });
  if (!exists) throw new NotFoundError(`岗位 ${jobId} 不存在`);
}

export async function setFavorite(jobId: number, userId: string, starred: boolean): Promise<{ starred: boolean }> {
  await assertJobExists(jobId);
  if (starred) {
    await prisma.favorite.upsert({
      where: { userId_jobId: { userId, jobId } },
      update: {},
      create: { userId, jobId },
    });
  } else {
    await prisma.favorite.deleteMany({ where: { userId, jobId } });
  }
  return { starred };
}

export async function setApplication(
  jobId: number,
  userId: string,
  status: AppStatus | null,
): Promise<{ applicationStatus: AppStatus | null }> {
  await assertJobExists(jobId);
  if (status) {
    await prisma.application.upsert({
      where: { userId_jobId: { userId, jobId } },
      update: { status },
      create: { userId, jobId, status },
    });
  } else {
    await prisma.application.deleteMany({ where: { userId, jobId } });
  }
  return { applicationStatus: status };
}

export async function getProgress(userId: string): Promise<JobProgress> {
  const today = dateKey();
  const weekStart = keyToInstant(weekStartKey(today));

  const [starred, applied, interviewing, newThisWeek, newInternshipsThisWeek, next] = await Promise.all([
    prisma.favorite.count({ where: { userId } }),
    prisma.application.count({ where: { userId, status: "APPLIED" } }),
    prisma.application.count({ where: { userId, status: "INTERVIEWING" } }),
    prisma.job.count({ where: { createTime: { gte: weekStart } } }),
    prisma.job.count({ where: { createTime: { gte: weekStart }, recruitmentBatch: { contains: "实习" } } }),
    prisma.favorite.findFirst({
      where: { userId, job: { deadlineAt: { gte: keyToDate(today) } } },
      orderBy: { job: { deadlineAt: "asc" } },
      select: { job: { select: { id: true, enterpriseName: true, deadlineAt: true } } },
    }),
  ]);

  return {
    starred,
    applied,
    interviewing,
    newThisWeek,
    newInternshipsThisWeek,
    nextDeadline: next?.job.deadlineAt
      ? {
          jobId: next.job.id,
          company: next.job.enterpriseName,
          daysLeft: daysBetween(today, dbDateToKey(next.job.deadlineAt)),
        }
      : null,
  };
}
