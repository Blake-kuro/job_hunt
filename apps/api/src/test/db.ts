import { DEV_USER_EMAIL } from "../auth";
import { createHash } from "node:crypto";
import app from "../app";
import { prisma } from "../db";
import type { Prisma } from "../generated/prisma/client";
import { JUDGE_OPTIONS } from "../lib/grade";

export const hasDb = Boolean(process.env.DATABASE_URL);

export async function resetDb() {
  if (!process.env.DATABASE_URL || !new URL(process.env.DATABASE_URL).pathname.endsWith("_test")) {
    throw new Error("拒绝清空非测试数据库");
  }
  await prisma.$executeRawUnsafe(
    'TRUNCATE "LessonProgress","CourseLesson","CourseChapter","Course","StudyMaterial","AccessGrant","SmsVerification","Session","AuthIdentity","Attempt","WrongBookEntry","Question","QuestionCategory","Company","Application","Favorite","Job","User" RESTART IDENTITY CASCADE',
  );
}

export async function seedDevUser() {
  const user = await prisma.user.create({
    data: {
      email: DEV_USER_EMAIL,
      name: "开发账号",
      role: "ADMIN",
      identities: { create: { provider: "PHONE", providerKey: "13800000000" } },
    },
  });
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

/** 带 cookie 罐的匿名客户端：自动回传 Set-Cookie（device / session） */
export function guestClient() {
  const jar = new Map<string, string>();
  return async (path: string, init: RequestInit = {}) => {
    const headers = new Headers(init.headers);
    if (jar.size) headers.set("cookie", [...jar].map(([k, v]) => `${k}=${v}`).join("; "));
    const res = await app.request(path, { ...init, headers });
    for (const line of res.headers.getSetCookie()) {
      const [pair, ...attrs] = line.split(";");
      const [k, v] = pair.split("=");
      if (attrs.some((a) => /max-age=0/i.test(a))) jar.delete(k.trim());
      else jar.set(k.trim(), v);
    }
    return res;
  };
}

/**
 * 一个公司「测试公司」+ 一个分类「基础」，25 道已发布题（sortOrder 1–25）：
 * 1–21 单选（4 选项，答案 B）、22–23 多选（4 选项，答案 AC）、24–25 判断（答案 A）。
 */
export async function seedBank() {
  const company = await prisma.company.create({ data: { id: "co-test", name: "测试公司" } });
  const category = await prisma.questionCategory.create({
    data: { id: "cat-test", companyId: company.id, name: "基础" },
  });
  const four = ["A", "B", "C", "D"].map((letter) => ({ letter, text: `选项 ${letter}` }));
  const ids: string[] = [];
  const data: Prisma.QuestionCreateManyInput[] = [];
  for (let n = 1; n <= 25; n++) {
    const id = `tq-${String(n).padStart(3, "0")}`;
    ids.push(id);
    const shape =
      n <= 21
        ? { type: "SINGLE" as const, options: four, answer: "B" }
        : n <= 23
          ? { type: "MULTI" as const, options: four, answer: "AC" }
          : {
              type: "JUDGE" as const,
              options: JUDGE_OPTIONS.map(({ letter, text }) => ({ letter, text })),
              answer: "A",
            };
    data.push({
      id,
      categoryId: category.id,
      sortOrder: n,
      prompt: `第 ${n} 题的题干，长度足够长以便测试截断到二十四个字的行为是否正确`,
      explanation: ["解析一", "解析二"],
      difficulty: "MEDIUM",
      source: "测试",
      ...shape,
    });
  }
  await prisma.question.createMany({ data });
  return { companyId: company.id, categoryId: category.id, ids };
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
