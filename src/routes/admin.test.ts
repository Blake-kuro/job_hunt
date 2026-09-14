import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import app from "../app";
import { prisma } from "../db";
import { apiRequest, hasDb, resetDb, seedDevUser } from "../test/db";

const json = (method: string, body: unknown) => ({
  method,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

async function studentSession(userId: string, token: string) {
  await prisma.session.create({
    data: {
      tokenHash: createHash("sha256").update(token).digest("hex"),
      userId,
      expiresAt: new Date(Date.now() + 60_000),
    },
  });
  return { cookie: `job_hunt_session=${token}` };
}

describe.skipIf(!hasDb)("/api/admin", () => {
  beforeEach(async () => {
    await resetDb();
    await seedDevUser();
  });

  it("概览计数区分学生 / 游客 / PRO", async () => {
    await prisma.user.create({
      data: { name: "游客", identities: { create: { provider: "DEVICE", providerKey: "d1" } } },
    });
    await prisma.user.create({
      data: {
        name: "PRO 学生",
        plan: "PRO",
        identities: { create: { provider: "PHONE", providerKey: "13900000001" } },
      },
    });
    await prisma.user.create({
      data: {
        name: "过期 PRO",
        plan: "PRO",
        proExpiresAt: new Date(Date.now() - 1000),
        identities: { create: { provider: "PHONE", providerKey: "13900000002" } },
      },
    });
    const res = await apiRequest("/api/admin/summary");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      students: 3,
      enabledStudents: 3,
      proStudents: 1,
      guests: 1,
      jobs: 0,
      questions: 0,
      materials: 0,
      courses: 0,
    });
  });

  it("学生列表支持搜索、分页，并带授权内容标题", async () => {
    const student = await prisma.user.create({
      data: { name: "张三", identities: { create: { provider: "PHONE", providerKey: "13900000000" } } },
    });
    const saved = await apiRequest(
      "/api/admin/content",
      json("POST", { type: "MATERIAL", title: "简历模板", url: "https://example.com/r", published: true }),
    );
    expect(saved.status).toBe(201);
    const { id: materialId } = (await saved.json()) as { id: string };
    expect(
      (
        await apiRequest(
          `/api/admin/students/${student.id}/access`,
          json("PUT", { grants: [{ contentType: "MATERIAL", contentId: materialId }] }),
        )
      ).status,
    ).toBe(204);
    const list = (await (await apiRequest("/api/admin/students?q=1390")).json()) as {
      items: { name: string; grants: { contentTitle: string | null }[] }[];
      total: number;
    };
    expect(list.total).toBe(1);
    expect(list.items[0]).toMatchObject({ name: "张三", tier: "FREE", grants: [{ contentTitle: "简历模板" }] });
    const empty = (await (await apiRequest("/api/admin/students?q=不存在")).json()) as { total: number };
    expect(empty.total).toBe(0);
  });

  it("授权不存在的内容返回 400；修改管理员返回 403", async () => {
    const student = await prisma.user.create({
      data: { name: "学生", identities: { create: { provider: "PHONE", providerKey: "13900000000" } } },
    });
    const bad = await apiRequest(
      `/api/admin/students/${student.id}/access`,
      json("PUT", { grants: [{ contentType: "COURSE", contentId: "nope" }] }),
    );
    expect(bad.status).toBe(400);
    const admin = await prisma.user.findFirstOrThrow({ where: { role: "ADMIN" } });
    expect((await apiRequest(`/api/admin/students/${admin.id}`, json("PATCH", { enabled: false }))).status).toBe(403);
    expect(
      (
        await apiRequest(
          `/api/admin/students/${student.id}`,
          json("PATCH", { plan: "PRO", proExpiresAt: null, name: "李四" }),
        )
      ).status,
    ).toBe(204);
    const row = await prisma.user.findUniqueOrThrow({ where: { id: student.id } });
    expect(row).toMatchObject({ plan: "PRO", proExpiresAt: null, name: "李四" });
  });

  it("课程可创建 / 更新 / 列表 / 删除，删除后授权也被清理", async () => {
    const body = {
      type: "COURSE",
      title: "面试课",
      published: false,
      lessons: [{ title: "第一课", videoUrl: "https://example.com/1.mp4", durationMinutes: 10 }],
    };
    const created = await apiRequest("/api/admin/content", json("POST", body));
    expect(created.status).toBe(201);
    const { id } = (await created.json()) as { id: string };
    expect(
      (await apiRequest("/api/admin/content", json("POST", { ...body, id, title: "面试课 2", lessons: [] }))).status,
    ).toBe(201);
    const list = (await (await apiRequest("/api/admin/courses")).json()) as {
      id: string;
      title: string;
      lessons: unknown[];
    }[];
    expect(list).toMatchObject([{ id, title: "面试课 2", lessons: [] }]);
    const student = await prisma.user.create({
      data: { name: "学生", identities: { create: { provider: "PHONE", providerKey: "13900000000" } } },
    });
    await apiRequest(
      `/api/admin/students/${student.id}/access`,
      json("PUT", { grants: [{ contentType: "COURSE", contentId: id }] }),
    );
    expect((await apiRequest(`/api/admin/content/COURSE/${id}`, { method: "DELETE" })).status).toBe(204);
    expect(await prisma.accessGrant.count()).toBe(0);
    expect((await apiRequest(`/api/admin/content/COURSE/${id}`, { method: "DELETE" })).status).toBe(404);
  });

  it("管理员可创建资料、授权学生，学生只能看到已授权内容", async () => {
    const saved = await apiRequest(
      "/api/admin/content",
      json("POST", {
        type: "MATERIAL",
        title: "简历模板",
        category: "求职资料",
        url: "https://example.com/resume",
        published: true,
      }),
    );
    expect(saved.status).toBe(201);
    const { id: materialId } = (await saved.json()) as { id: string };
    const materials = (await (await apiRequest("/api/admin/materials")).json()) as { id: string; title: string }[];
    expect(materials).toMatchObject([{ id: materialId, title: "简历模板" }]);
    const student = await prisma.user.create({
      data: { name: "学生", identities: { create: { provider: "PHONE", providerKey: "13900000000" } } },
    });
    await apiRequest(
      `/api/admin/students/${student.id}/access`,
      json("PUT", { grants: [{ contentType: "MATERIAL", contentId: materialId }] }),
    );
    const headers = await studentSession(student.id, "student-session");
    const content = await app.request("/api/content", { headers });
    expect(content.status).toBe(200);
    expect(await content.json()).toMatchObject({ materials: [{ title: "简历模板" }], courses: [] });
  });

  it("普通学生不能访问后台，停用后不能访问业务接口", async () => {
    const student = await prisma.user.create({ data: { name: "学生" } });
    const headers = await studentSession(student.id, "disabled-session");
    expect((await app.request("/api/admin/summary", { headers })).status).toBe(403);
    await prisma.user.update({ where: { id: student.id }, data: { enabled: false } });
    expect((await app.request("/api/content", { headers })).status).toBe(403);
  });

  it("内容体按类型校验：MATERIAL 缺少 url → 400 VALIDATION", async () => {
    const res = await apiRequest(
      "/api/admin/content",
      json("POST", { type: "MATERIAL", title: "无链接资料", published: true }),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: { code: "VALIDATION" } });
  });

  it("题库：分类、分页列表、创建 / 修改 / 删除", async () => {
    const cat = await apiRequest("/api/admin/question-categories", json("POST", { name: "算法" }));
    expect(cat.status).toBe(201);
    const { id: categoryId } = (await cat.json()) as { id: string };
    expect((await apiRequest("/api/admin/question-categories", json("POST", { name: "算法" }))).status).toBe(400);
    const body = {
      prompt: "1+1=?",
      categoryId,
      options: [
        { letter: "A", text: "1" },
        { letter: "B", text: "2" },
        { letter: "C", text: "3" },
        { letter: "D", text: "4" },
      ],
      answer: "B",
      explanation: ["加法"],
      difficulty: "EASY",
      source: "自编",
      published: false,
    };
    const created = await apiRequest("/api/admin/questions", json("POST", body));
    expect(created.status).toBe(201);
    const { id } = (await created.json()) as { id: string };
    expect((await apiRequest("/api/admin/questions", json("POST", { ...body, categoryId: "nope" }))).status).toBe(400);
    expect((await apiRequest("/api/admin/questions", json("POST", { ...body, companySetId: "" }))).status).toBe(400);
    const meta = (await (await apiRequest("/api/admin/quiz-meta")).json()) as {
      categories: { name: string; questionCount: number }[];
    };
    expect(meta.categories).toMatchObject([{ name: "算法", questionCount: 1 }]);
    expect((await apiRequest(`/api/admin/questions/${id}`, json("PATCH", { published: true }))).status).toBe(204);
    const list = (await (await apiRequest("/api/admin/questions?published=true&q=1%2B1")).json()) as {
      total: number;
      items: { categoryName: string; options: unknown[] }[];
    };
    expect(list.total).toBe(1);
    expect(list.items[0]).toMatchObject({ categoryName: "算法", answer: "B", published: true });
    expect(list.items[0].options).toHaveLength(4);
    const student = await prisma.user.create({
      data: { name: "学生", identities: { create: { provider: "PHONE", providerKey: "13900000099" } } },
    });
    expect(
      (
        await apiRequest(
          `/api/admin/students/${student.id}/access`,
          json("PUT", { grants: [{ contentType: "QUESTION", contentId: id }] }),
        )
      ).status,
    ).toBe(204);
    expect(await prisma.accessGrant.count()).toBe(1);
    expect((await apiRequest(`/api/admin/questions/${id}`, { method: "DELETE" })).status).toBe(204);
    expect((await apiRequest(`/api/admin/questions/${id}`, { method: "DELETE" })).status).toBe(404);
    expect(await prisma.question.count()).toBe(0);
    expect(await prisma.accessGrant.count()).toBe(0);
  });
});
