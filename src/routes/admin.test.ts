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

describe.skipIf(!hasDb)("/api/admin", () => {
  beforeEach(async () => {
    await resetDb();
    await seedDevUser();
  });

  it("管理员可创建资料、授权学生，学生只能看到已授权内容", async () => {
    expect(
      (
        await apiRequest(
          "/api/admin/content",
          json("POST", {
            type: "MATERIAL",
            title: "简历模板",
            category: "求职资料",
            url: "https://example.com/resume",
            published: true,
          }),
        )
      ).status,
    ).toBe(204);
    const dashboard = (await (await apiRequest("/api/admin/dashboard")).json()) as {
      materials: { id: string }[];
    };
    const student = await prisma.user.create({
      data: { name: "学生", identities: { create: { provider: "PHONE", providerKey: "13900000000" } } },
    });
    await apiRequest(
      `/api/admin/students/${student.id}/access`,
      json("PUT", { grants: [{ contentType: "MATERIAL", contentId: dashboard.materials[0].id }] }),
    );
    const token = "student-session";
    await prisma.session.create({
      data: {
        tokenHash: createHash("sha256").update(token).digest("hex"),
        userId: student.id,
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    const content = await app.request("/api/content", { headers: { cookie: `job_hunt_session=${token}` } });
    expect(content.status).toBe(200);
    expect(await content.json()).toMatchObject({ materials: [{ title: "简历模板" }], courses: [] });
  });

  it("普通学生不能访问后台，停用后不能访问业务接口", async () => {
    const token = "disabled-session";
    const student = await prisma.user.create({ data: { name: "学生" } });
    await prisma.session.create({
      data: {
        tokenHash: createHash("sha256").update(token).digest("hex"),
        userId: student.id,
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    const headers = { cookie: `job_hunt_session=${token}` };
    expect((await app.request("/api/admin/dashboard", { headers })).status).toBe(403);
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

  it("不能修改管理员账号", async () => {
    const admin2 = await prisma.user.create({
      data: {
        name: "另一个管理员",
        role: "ADMIN",
        identities: { create: { provider: "PHONE", providerKey: "13911112222" } },
      },
    });
    const res = await apiRequest(`/api/admin/students/${admin2.id}`, json("PATCH", { enabled: false }));
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: { code: "FORBIDDEN" } });
  });

  it("创建题目时 categoryId 不存在 → 400 VALIDATION", async () => {
    const res = await apiRequest(
      "/api/admin/questions",
      json("POST", {
        prompt: "题干",
        categoryId: "not-exist",
        options: [
          { letter: "A", text: "A" },
          { letter: "B", text: "B" },
          { letter: "C", text: "C" },
          { letter: "D", text: "D" },
        ],
        answer: "A",
        explanation: ["解析"],
        difficulty: "EASY",
        source: "测试",
        published: true,
      }),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: { code: "VALIDATION" } });
  });
});
