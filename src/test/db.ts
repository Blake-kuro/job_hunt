import { DEV_USER_EMAIL } from "../auth";
import { createHash } from "node:crypto";
import app from "../app";
import { prisma } from "../db";
import type { Prisma } from "../generated/prisma/client";

export const hasDb = Boolean(process.env.DATABASE_URL);

export async function resetDb() {
  if (!process.env.DATABASE_URL || !new URL(process.env.DATABASE_URL).pathname.endsWith("_test")) {
    throw new Error("拒绝清空非测试数据库");
  }
  await prisma.$executeRawUnsafe(
    'TRUNCATE "SmsVerification","Session","AuthIdentity","Attempt","WrongBookEntry","Question","CompanySet","QuestionCategory","Application","Favorite","Job","User" RESTART IDENTITY CASCADE',
  );
}

export async function seedDevUser() {
  const user = await prisma.user.create({ data: { email: DEV_USER_EMAIL, name: "开发账号" } });
  await prisma.session.create({
    data: {
      tokenHash: createHash("sha256").update(TEST_SESSION_TOKEN).digest("hex"),
      userId: user.id,
      expiresAt: new Date(Date.now() + 60_000),
    },
  });
  return user;
}

const TEST_SESSION_TOKEN = "integration-test-session";

export function apiRequest(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("cookie", `job_hunt_session=${TEST_SESSION_TOKEN}`);
  return app.request(path, { ...init, headers });
}

export async function insertJobs(rows: Prisma.JobCreateManyInput[]) {
  await prisma.job.createMany({ data: rows });
}

/** 三条固定岗位：id 1/2/3 分别属于分类 1/2/3 */
export function jobFixture(todayKey: string, addDays: (k: string, n: number) => string): Prisma.JobCreateManyInput[] {
  return [
    {
      id: 1,
      categoryId: 1,
      enterpriseName: "泡泡玛特",
      position: "产品经理、运营",
      workLocation: "北京、上海",
      recruitmentBatch: "2027 实习",
      deadline: addDays(todayKey, 5),
      deadlineAt: new Date(`${addDays(todayKey, 5)}T00:00:00Z`),
      createTime: new Date(),
    },
    {
      id: 2,
      categoryId: 2,
      enterpriseName: "国家电网",
      position: "电气工程师",
      workLocation: "杭州",
      recruitmentBatch: "2027 秋招",
      deadline: addDays(todayKey, 20),
      deadlineAt: new Date(`${addDays(todayKey, 20)}T00:00:00Z`),
      createTime: new Date(Date.now() - 30 * 86_400_000),
    },
    {
      id: 3,
      categoryId: 3,
      enterpriseName: "丘钛集团",
      position: "算法工程师",
      workLocation: "深圳",
      recruitmentBatch: "2027 秋招",
      deadline: null,
      deadlineAt: null,
      createTime: new Date(Date.now() - 2 * 86_400_000),
    },
  ];
}
