import { createHash } from "node:crypto";
import ExcelJS from "exceljs";
import { beforeEach, describe, expect, it } from "vitest";
import app from "../app";
import { prisma } from "../db";
import { apiRequest, hasDb, resetDb, seedDevUser } from "../test/db";
import { jsonInit as json } from "../test/http";

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
      companies: 0,
      questions: 0,
      materials: 0,
      courses: 0,
      readyLessons: 0,
      courseGrants: 0,
    });
  });

  it("学生列表支持搜索、分页，并带授权内容标题", async () => {
    const student = await prisma.user.create({
      data: { name: "张三", identities: { create: { provider: "PHONE", providerKey: "13900000000" } } },
    });
    const saved = await apiRequest(
      "/api/admin/content",
      json("POST", { title: "简历模板", url: "https://example.com/r", published: true }),
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

  it("管理员可创建资料、授权学生，学生只能看到已授权内容", async () => {
    const saved = await apiRequest(
      "/api/admin/content",
      json("POST", {
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
    expect(await content.json()).toEqual({
      materials: [
        {
          id: materialId,
          title: "简历模板",
          description: null,
          category: "求职资料",
          resourceUrl: "https://example.com/resume",
        },
      ],
    });
  });

  it("普通学生不能访问后台，停用后不能访问业务接口", async () => {
    const student = await prisma.user.create({ data: { name: "学生" } });
    const headers = await studentSession(student.id, "disabled-session");
    expect((await app.request("/api/admin/summary", { headers })).status).toBe(403);
    await prisma.user.update({ where: { id: student.id }, data: { enabled: false } });
    expect((await app.request("/api/content", { headers })).status).toBe(403);
  });

  it("资料体校验：缺少 url → 400 VALIDATION；`POST /content` 不再接受课程", async () => {
    const res = await apiRequest("/api/admin/content", json("POST", { title: "无链接资料", published: true }));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: { code: "VALIDATION" } });
    const course = await apiRequest(
      "/api/admin/content",
      json("POST", { type: "COURSE", title: "课", published: false, lessons: [] }),
    );
    expect(course.status).toBe(400);
    expect((await apiRequest("/api/admin/content/COURSE/x", { method: "DELETE" })).status).toBe(400);
  });

  it("题库：公司 / 分类、分页列表、创建 / 修改 / 删除、形状校验", async () => {
    const company = await prisma.company.create({ data: { name: "测试公司" } });
    const cat = await apiRequest(
      "/api/admin/question-categories",
      json("POST", { companyId: company.id, name: "算法" }),
    );
    expect(cat.status).toBe(201);
    const { id: categoryId } = (await cat.json()) as { id: string };
    expect(
      (await apiRequest("/api/admin/question-categories", json("POST", { companyId: company.id, name: "算法" })))
        .status,
    ).toBe(400);
    expect(
      (await apiRequest("/api/admin/question-categories", json("POST", { companyId: "nope", name: "算法" }))).status,
    ).toBe(400);
    const body = {
      prompt: "1+1=?",
      categoryId,
      type: "SINGLE",
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
    const badMulti = await apiRequest("/api/admin/questions", json("POST", { ...body, type: "MULTI", answer: "A" }));
    expect(badMulti.status).toBe(400);
    expect(await badMulti.json()).toMatchObject({
      error: { code: "VALIDATION", message: "多选题至少 3 个选项、2 个正确答案" },
    });
    expect((await apiRequest(`/api/admin/questions/${id}`, json("PATCH", { answer: "AB" }))).status).toBe(400);
    const meta = (await (await apiRequest("/api/admin/quiz-meta")).json()) as {
      companies: { name: string; categories: { name: string; questionCount: number; publishedCount: number }[] }[];
    };
    expect(meta.companies).toMatchObject([
      { name: "测试公司", categories: [{ name: "算法", questionCount: 1, publishedCount: 0 }] },
    ]);
    expect(
      (await apiRequest(`/api/admin/questions/${id}`, json("PATCH", { published: true, section: " 基础 " }))).status,
    ).toBe(204);
    const list = (await (
      await apiRequest(`/api/admin/questions?published=true&q=1%2B1&companyId=${company.id}`)
    ).json()) as {
      total: number;
      items: { categoryName: string; options: unknown[] }[];
    };
    expect(list.total).toBe(1);
    expect(list.items[0]).toMatchObject({
      companyName: "测试公司",
      categoryName: "算法",
      type: "SINGLE",
      section: "基础",
      sortOrder: 0,
      answer: "B",
      published: true,
    });
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

  it("公司 / 分类：创建、重名、改名、导入 Excel、删除公司级联", async () => {
    const created = await apiRequest("/api/admin/companies", json("POST", { name: " 中国华电 " }));
    expect(created.status).toBe(201);
    const company = (await created.json()) as { id: string; name: string; sortOrder: number };
    expect(company).toMatchObject({ name: "中国华电", sortOrder: 0 });
    const dup = await apiRequest("/api/admin/companies", json("POST", { name: "中国华电" }));
    expect(dup.status).toBe(400);
    expect(await dup.json()).toMatchObject({ error: { code: "VALIDATION", message: "公司已存在" } });

    expect(
      (await apiRequest(`/api/admin/companies/${company.id}`, json("PATCH", { name: "华电", sortOrder: 2 }))).status,
    ).toBe(204);
    expect((await apiRequest("/api/admin/companies/nope", json("PATCH", { name: "x" }))).status).toBe(404);
    const other = (await (await apiRequest("/api/admin/companies", json("POST", { name: "国家电网" }))).json()) as {
      id: string;
    };
    expect((await apiRequest(`/api/admin/companies/${other.id}`, json("PATCH", { name: "华电" }))).status).toBe(400);
    expect((await apiRequest(`/api/admin/companies/${other.id}`, json("PATCH", { sortOrder: 1 }))).status).toBe(204);

    const cat = await apiRequest(
      "/api/admin/question-categories",
      json("POST", { companyId: company.id, name: "公共与行业知识" }),
    );
    expect(cat.status).toBe(201);
    const category = (await cat.json()) as { id: string };
    const dupCat = await apiRequest(
      "/api/admin/question-categories",
      json("POST", { companyId: company.id, name: "公共与行业知识" }),
    );
    expect(dupCat.status).toBe(400);
    expect(await dupCat.json()).toMatchObject({ error: { message: "分类已存在" } });
    expect(
      (await apiRequest(`/api/admin/question-categories/${category.id}`, json("PATCH", { name: "行业知识" }))).status,
    ).toBe(204);
    expect((await apiRequest("/api/admin/question-categories/nope", json("PATCH", { name: "x" }))).status).toBe(404);

    const wb = new ExcelJS.Workbook();
    wb.addWorksheet("题库").addRows([
      ["题号", "题型", "所属部分", "题干", "A", "B", "C", "D", "答案"],
      [1, "单选题", "第一部分", "1+1=?", "1", "2", "3", "4", "B"],
      [2, "多选题", "第一部分", "哪些是偶数？", "2", "3", "4", "5", "AC"],
      [3, "判断题", "", "地球是圆的", "", "", "", "", "A"],
    ]);
    const form = new FormData();
    form.append("file", new File([Buffer.from(await wb.xlsx.writeBuffer())], "questions.xlsx"));
    const imported = await apiRequest(`/api/admin/question-categories/${category.id}/import`, {
      method: "POST",
      body: form,
    });
    expect(imported.status).toBe(200);
    expect(await imported.json()).toEqual({ created: 3, skipped: [] });

    const meta = (await (await apiRequest("/api/admin/quiz-meta")).json()) as {
      companies: { name: string; categories: { name: string; questionCount: number; publishedCount: number }[] }[];
    };
    expect(meta.companies).toMatchObject([
      { name: "国家电网", categories: [] },
      { name: "华电", categories: [{ name: "行业知识", questionCount: 3, publishedCount: 3 }] },
    ]);
    expect(await (await apiRequest("/api/admin/summary")).json()).toMatchObject({ companies: 2, questions: 3 });

    const bad = new FormData();
    bad.append("file", new File(["not excel"], "x.xlsx"));
    const badRes = await apiRequest(`/api/admin/question-categories/${category.id}/import`, {
      method: "POST",
      body: bad,
    });
    expect(badRes.status).toBe(400);
    expect(await badRes.json()).toMatchObject({ error: { message: "无法解析 Excel 文件：不是有效的 xlsx 文件" } });
    const noHeader = new ExcelJS.Workbook();
    noHeader.addWorksheet("x").addRow(["a", "b"]);
    const noHeaderForm = new FormData();
    noHeaderForm.append("file", new File([Buffer.from(await noHeader.xlsx.writeBuffer())], "x.xlsx"));
    const noHeaderRes = await apiRequest(`/api/admin/question-categories/${category.id}/import`, {
      method: "POST",
      body: noHeaderForm,
    });
    expect(noHeaderRes.status).toBe(400);
    expect(await noHeaderRes.json()).toMatchObject({
      error: { message: "无法解析 Excel 文件：找不到含 题干 / 答案 列的工作表" },
    });
    const missing = new FormData();
    missing.append("file", new File([Buffer.from(await wb.xlsx.writeBuffer())], "questions.xlsx"));
    expect(
      (await apiRequest("/api/admin/question-categories/nope/import", { method: "POST", body: missing })).status,
    ).toBe(404);

    expect((await apiRequest(`/api/admin/companies/${company.id}`, { method: "DELETE" })).status).toBe(204);
    expect((await apiRequest(`/api/admin/companies/${company.id}`, { method: "DELETE" })).status).toBe(404);
    expect(await prisma.question.count()).toBe(0);
    expect(await prisma.questionCategory.count()).toBe(0);
    expect((await apiRequest("/api/admin/question-categories/nope", { method: "DELETE" })).status).toBe(404);
  });

  it("删除分类级联题目", async () => {
    const company = await prisma.company.create({ data: { name: "测试公司" } });
    const category = await prisma.questionCategory.create({ data: { companyId: company.id, name: "基础" } });
    await prisma.question.create({
      data: {
        categoryId: category.id,
        prompt: "q",
        options: [
          { letter: "A", text: "1" },
          { letter: "B", text: "2" },
        ],
        answer: "A",
        source: "s",
      },
    });
    expect((await apiRequest(`/api/admin/question-categories/${category.id}`, { method: "DELETE" })).status).toBe(204);
    expect(await prisma.question.count()).toBe(0);
    expect(await prisma.company.count()).toBe(1);
  });

  it("岗位：创建 / 列表 / 修改 / 删除", async () => {
    const created = await apiRequest(
      "/api/admin/jobs",
      json("POST", {
        categoryId: 2,
        enterpriseName: "国家电网",
        position: "电气工程师",
        workLocation: "杭州",
        deadlineAt: "2027-01-31",
      }),
    );
    expect(created.status).toBe(201);
    const { id } = (await created.json()) as { id: number };
    const list = (await (await apiRequest("/api/admin/jobs?q=电网&category=2")).json()) as {
      total: number;
      items: { deadlineAt: string | null; stats: { favorites: number } }[];
    };
    expect(list.total).toBe(1);
    expect(list.items[0]).toMatchObject({
      id,
      deadlineAt: "2027-01-31",
      industry: null,
      stats: { favorites: 0, applications: 0 },
    });
    expect(
      (await apiRequest(`/api/admin/jobs/${id}`, json("PATCH", { deadlineAt: null, industry: "能源" }))).status,
    ).toBe(204);
    const row = await prisma.job.findUniqueOrThrow({ where: { id } });
    expect(row).toMatchObject({ deadlineAt: null, industry: "能源" });
    expect((await apiRequest(`/api/admin/jobs/${id}`, { method: "DELETE" })).status).toBe(204);
    expect((await apiRequest(`/api/admin/jobs/${id}`, { method: "DELETE" })).status).toBe(404);
  });

  it("岗位：上传 Excel 导入", async () => {
    const upload = (buffer: Buffer) => {
      const form = new FormData();
      form.append("file", new File([buffer], "jobs.xlsx"));
      return apiRequest("/api/admin/jobs/import", { method: "POST", body: form });
    };
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("央国企");
    ws.addRow(["enterpriseName", "position", "workLocation", "deadline"]);
    ws.addRow(["中国移动", "网络工程师", "北京", "2027-03-01"]);
    ws.addRow(["中国电信", "产品经理", "上海", ""]);
    ws.addRow(["", "缺企业名", "", ""]);
    const buffer = Buffer.from(await wb.xlsx.writeBuffer());
    const form = new FormData();
    form.append(
      "file",
      new File([buffer], "jobs.xlsx", {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
    );
    const res = await apiRequest("/api/admin/jobs/import", { method: "POST", body: form });
    expect(res.status).toBe(200);
    const result = (await res.json()) as { sheets: { skipped: string[] }[] };
    expect(result).toMatchObject({
      sheets: [{ name: "央国企", created: 2, updated: 0 }],
      usedIdKey: false,
    });
    expect(result.sheets[0].skipped).toHaveLength(1);
    expect(result.sheets[0].skipped[0]).toContain("缺少 enterpriseName");
    expect(await prisma.job.count({ where: { categoryId: 2 } })).toBe(2);

    // 带 id / serialNumber 列：先按 id 新建，再按 serialNumber 更新；序列被同步到 MAX(id)
    const withId = new ExcelJS.Workbook();
    withId.addWorksheet("外企").addRows([
      ["id", "serialNumber", "enterpriseName", "position"],
      [100, "SN-100", "西门子", "研发工程师"],
    ]);
    const first = await upload(Buffer.from(await withId.xlsx.writeBuffer()));
    expect(first.status).toBe(200);
    expect(await first.json()).toMatchObject({ sheets: [{ created: 1, updated: 0 }], usedIdKey: true });
    const bySerial = new ExcelJS.Workbook();
    bySerial.addWorksheet("外企").addRows([
      ["serialNumber", "enterpriseName", "position"],
      ["SN-100", "西门子", "研发工程师（更新）"],
    ]);
    const second = await upload(Buffer.from(await bySerial.xlsx.writeBuffer()));
    expect(second.status).toBe(200);
    expect(await second.json()).toMatchObject({ sheets: [{ created: 0, updated: 1 }], usedIdKey: false });
    expect(await prisma.job.findUniqueOrThrow({ where: { id: 100 } })).toMatchObject({
      position: "研发工程师（更新）",
    });
    const again = await upload(Buffer.from(await withId.xlsx.writeBuffer()));
    expect(await again.json()).toMatchObject({ sheets: [{ created: 0, updated: 1 }], usedIdKey: true });
    const created = await apiRequest(
      "/api/admin/jobs",
      json("POST", { categoryId: 1, enterpriseName: "新企业", position: "新岗位", industry: "  " }),
    );
    expect(created.status).toBe(201);
    expect(await created.json()).toEqual({ id: 101 });
    expect(await prisma.job.findUniqueOrThrow({ where: { id: 101 } })).toMatchObject({ industry: null });
    const bad = new FormData();
    bad.append("file", new File(["not excel"], "x.xlsx"));
    expect((await apiRequest("/api/admin/jobs/import", { method: "POST", body: bad })).status).toBe(400);
  });
});
