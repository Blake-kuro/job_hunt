import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../db";
import { apiRequest, hasDb, resetDb, seedDevUser } from "../test/db";
import { jsonInit as json } from "../test/http";

type IdResult = { id: string };
type Lesson = {
  id: string;
  chapterId: string | null;
  title: string;
  sortOrder: number;
  freePreview: boolean;
  videoFileId: string | null;
  videoStatus: string;
  durationSeconds: number | null;
};
type Detail = {
  id: string;
  title: string;
  priceCents: number;
  lessonCount: number;
  readyCount: number;
  grantCount: number;
  chapters: { id: string; title: string; sortOrder: number; lessons: Lesson[] }[];
  unchaptered: Lesson[];
};
type Paged<T> = { items: T[]; total: number; page: number; pageSize: number };

async function createCourse(body: Record<string, unknown> = {}) {
  const res = await apiRequest(
    "/api/admin/courses",
    json("POST", { title: "面试课", priceCents: 9900, published: false, ...body }),
  );
  expect(res.status).toBe(201);
  return ((await res.json()) as IdResult).id;
}
async function post(path: string, body: unknown) {
  const res = await apiRequest(path, json("POST", body));
  return { status: res.status, body: (await res.json().catch(() => null)) as IdResult | null };
}
const detail = async (id: string) => (await (await apiRequest(`/api/admin/courses/${id}`)).json()) as Detail;
const student = (phone: string, name = "学生") =>
  prisma.user.create({ data: { name, identities: { create: { provider: "PHONE", providerKey: phone } } } });

describe.skipIf(!hasDb)("/api/admin 课程", () => {
  beforeEach(async () => {
    await resetDb();
    await seedDevUser();
  });

  it("课程：创建 / 详情 / 修改 / 分页列表（搜索、发布过滤、计数）/ 删除", async () => {
    const id = await createCourse({ summary: "一句话", teacher: "王老师", coverUrl: "https://x/c.png" });
    expect(await detail(id)).toMatchObject({
      id,
      title: "面试课",
      priceCents: 9900,
      published: false,
      summary: "一句话",
      teacher: "王老师",
      coverUrl: "https://x/c.png",
      description: null,
      sortOrder: 0,
      lessonCount: 0,
      readyCount: 0,
      grantCount: 0,
      chapters: [],
      unchaptered: [],
    });

    const patched = await apiRequest(
      `/api/admin/courses/${id}`,
      json("PATCH", { title: "面试课 2", published: true, coverUrl: null, description: "详细\n介绍", sortOrder: 5 }),
    );
    expect(patched.status).toBe(204);
    expect(await detail(id)).toMatchObject({
      title: "面试课 2",
      published: true,
      coverUrl: null,
      description: "详细\n介绍",
      teacher: "王老师",
      sortOrder: 5,
    });
    expect((await apiRequest(`/api/admin/courses/${id}`, json("PATCH", { priceCents: -1 }))).status).toBe(400);
    expect((await apiRequest(`/api/admin/courses/${id}`, json("PATCH", { coverUrl: "not-url" }))).status).toBe(400);
    expect((await apiRequest("/api/admin/courses/nope", json("PATCH", { title: "x" }))).status).toBe(404);
    expect((await apiRequest("/api/admin/courses/nope")).status).toBe(404);
    expect(
      (await apiRequest("/api/admin/courses", json("POST", { title: "", priceCents: 0, published: false }))).status,
    ).toBe(400);

    const free = await createCourse({ title: "免费课", priceCents: 0, published: false });
    await prisma.courseLesson.createMany({
      data: [
        { courseId: free, title: "一", videoStatus: "READY", videoFileId: "f1" },
        { courseId: free, title: "二", videoStatus: "PROCESSING" },
      ],
    });
    const s = await student("13900000001");
    await prisma.accessGrant.create({ data: { userId: s.id, contentType: "COURSE", contentId: free } });

    const all = (await (await apiRequest("/api/admin/courses")).json()) as Paged<Detail>;
    expect(all.total).toBe(2);
    // 按 sortOrder 升序：免费课 0 在前
    expect(all.items.map((c) => c.id)).toEqual([free, id]);
    expect(all.items[0]).toMatchObject({ lessonCount: 2, readyCount: 1, grantCount: 1 });
    const published = (await (await apiRequest("/api/admin/courses?published=true")).json()) as Paged<Detail>;
    expect(published.items.map((c) => c.id)).toEqual([id]);
    const searched = (await (await apiRequest("/api/admin/courses?q=免费")).json()) as Paged<Detail>;
    expect(searched.items.map((c) => c.id)).toEqual([free]);
    const page2 = (await (await apiRequest("/api/admin/courses?page=2&pageSize=1")).json()) as Paged<Detail>;
    expect(page2).toMatchObject({ total: 2, page: 2, pageSize: 1 });
    expect(page2.items.map((c) => c.id)).toEqual([id]);

    // 删除：级联课时 / 进度，事务里清 AccessGrant{COURSE}
    const lesson = await prisma.courseLesson.findFirstOrThrow({ where: { courseId: free } });
    await prisma.lessonProgress.create({ data: { userId: s.id, lessonId: lesson.id, courseId: free } });
    await prisma.accessGrant.create({ data: { userId: s.id, contentType: "MATERIAL", contentId: "m1" } });
    expect((await apiRequest(`/api/admin/courses/${free}`, { method: "DELETE" })).status).toBe(204);
    expect(await prisma.courseLesson.count({ where: { courseId: free } })).toBe(0);
    expect(await prisma.lessonProgress.count()).toBe(0);
    expect(await prisma.accessGrant.findMany()).toMatchObject([{ contentType: "MATERIAL", contentId: "m1" }]);
    expect((await apiRequest(`/api/admin/courses/${free}`, { method: "DELETE" })).status).toBe(404);
  });

  it("章 / 课时：创建排在最后、改章归属校验、删章课时回到无章、删课时级联进度", async () => {
    const courseId = await createCourse();
    const other = await createCourse({ title: "别的课" });
    const ch1 = (await post(`/api/admin/courses/${courseId}/chapters`, { title: "第一章" })).body?.id as string;
    const ch2 = (await post(`/api/admin/courses/${courseId}/chapters`, { title: "第二章" })).body?.id as string;
    const foreign = (await post(`/api/admin/courses/${other}/chapters`, { title: "别人的章" })).body?.id as string;
    expect((await post("/api/admin/courses/nope/chapters", { title: "x" })).status).toBe(404);
    expect((await post(`/api/admin/courses/${courseId}/chapters`, { title: " " })).status).toBe(400);

    const l1 = (await post(`/api/admin/courses/${courseId}/lessons`, { title: "一", chapterId: ch1 })).body
      ?.id as string;
    const l2 = (
      await post(`/api/admin/courses/${courseId}/lessons`, { title: "二", chapterId: ch1, freePreview: true })
    ).body?.id as string;
    const l3 = (await post(`/api/admin/courses/${courseId}/lessons`, { title: "三" })).body?.id as string;
    // 章不属于该课 → 400
    expect((await post(`/api/admin/courses/${courseId}/lessons`, { title: "四", chapterId: foreign })).status).toBe(
      400,
    );
    expect((await post(`/api/admin/courses/${courseId}/lessons`, { title: "四", chapterId: "nope" })).status).toBe(400);

    let d = await detail(courseId);
    expect(d.chapters.map((c) => [c.title, c.sortOrder, c.lessons.map((l) => l.id)])).toEqual([
      ["第一章", 0, [l1, l2]],
      ["第二章", 1, []],
    ]);
    expect(d.unchaptered.map((l) => l.id)).toEqual([l3]);
    expect(d.chapters[0].lessons[1]).toMatchObject({
      title: "二",
      freePreview: true,
      sortOrder: 1,
      videoFileId: null,
      videoStatus: "NONE",
      durationSeconds: null,
    });
    expect(d.lessonCount).toBe(3);

    // PATCH 章 / 课时
    expect((await apiRequest(`/api/admin/chapters/${ch2}`, json("PATCH", { title: "第二章·改" }))).status).toBe(204);
    expect((await apiRequest("/api/admin/chapters/nope", json("PATCH", { title: "x" }))).status).toBe(404);
    expect(
      (
        await apiRequest(
          `/api/admin/lessons/${l3}`,
          json("PATCH", { chapterId: ch2, title: "三·改", freePreview: true }),
        )
      ).status,
    ).toBe(204);
    expect((await apiRequest(`/api/admin/lessons/${l3}`, json("PATCH", { chapterId: foreign }))).status).toBe(400);
    expect((await apiRequest("/api/admin/lessons/nope", json("PATCH", { title: "x" }))).status).toBe(404);
    d = await detail(courseId);
    expect(d.chapters[1]).toMatchObject({
      title: "第二章·改",
      lessons: [{ id: l3, title: "三·改", freePreview: true }],
    });
    expect(d.unchaptered).toEqual([]);

    // 删章：课时 chapterId → null，不删课时
    expect((await apiRequest(`/api/admin/chapters/${ch1}`, { method: "DELETE" })).status).toBe(204);
    expect((await apiRequest(`/api/admin/chapters/${ch1}`, { method: "DELETE" })).status).toBe(404);
    d = await detail(courseId);
    expect(d.chapters.map((c) => c.id)).toEqual([ch2]);
    expect(d.unchaptered.map((l) => l.id)).toEqual([l1, l2]);

    // 删课时：级联进度
    const s = await student("13900000001");
    await prisma.lessonProgress.create({ data: { userId: s.id, lessonId: l1, courseId, positionSeconds: 5 } });
    expect((await apiRequest(`/api/admin/lessons/${l1}`, { method: "DELETE" })).status).toBe(204);
    expect((await apiRequest(`/api/admin/lessons/${l1}`, { method: "DELETE" })).status).toBe(404);
    expect(await prisma.lessonProgress.count()).toBe(0);
    expect((await detail(courseId)).lessonCount).toBe(2);
  });

  it("排序：一次性写章顺序与课时归属 / 顺序；缺课时 / 重复 / 外来 id → 400", async () => {
    const courseId = await createCourse();
    const other = await createCourse({ title: "别的课" });
    const ch1 = (await post(`/api/admin/courses/${courseId}/chapters`, { title: "A" })).body?.id as string;
    const ch2 = (await post(`/api/admin/courses/${courseId}/chapters`, { title: "B" })).body?.id as string;
    const foreignChapter = (await post(`/api/admin/courses/${other}/chapters`, { title: "X" })).body?.id as string;
    const ids: string[] = [];
    for (const title of ["1", "2", "3", "4"]) {
      ids.push((await post(`/api/admin/courses/${courseId}/lessons`, { title, chapterId: ch1 })).body?.id as string);
    }
    const foreignLesson = (await post(`/api/admin/courses/${other}/lessons`, { title: "y" })).body?.id as string;
    const [l1, l2, l3, l4] = ids;
    const put = (body: unknown) => apiRequest(`/api/admin/courses/${courseId}/lessons/order`, json("PUT", body));

    const ok = await put({
      chapters: [
        { id: ch2, lessonIds: [l4, l1] },
        { id: ch1, lessonIds: [l3] },
      ],
      unchaptered: [l2],
    });
    expect(ok.status).toBe(204);
    const d = await detail(courseId);
    expect(d.chapters.map((c) => [c.id, c.sortOrder, c.lessons.map((l) => l.id)])).toEqual([
      [ch2, 0, [l4, l1]],
      [ch1, 1, [l3]],
    ]);
    expect(d.unchaptered.map((l) => l.id)).toEqual([l2]);
    // 全局 sortOrder 连续：ch2 的两课 0/1，ch1 的 2，无章的 3
    const rows = await prisma.courseLesson.findMany({ where: { courseId }, orderBy: { sortOrder: "asc" } });
    expect(rows.map((r) => [r.id, r.sortOrder, r.chapterId])).toEqual([
      [l4, 0, ch2],
      [l1, 1, ch2],
      [l3, 2, ch1],
      [l2, 3, null],
    ]);

    const full = { chapters: [{ id: ch1, lessonIds: [l1, l2, l3] }], unchaptered: [l4] };
    expect((await put({ ...full, unchaptered: [] })).status).toBe(400); // 缺 l4
    expect((await put({ ...full, unchaptered: [l4, l4] })).status).toBe(400); // 重复
    expect((await put({ ...full, unchaptered: [l4, foreignLesson] })).status).toBe(400); // 外来课时
    expect((await put({ chapters: [{ id: foreignChapter, lessonIds: [] }], unchaptered: ids })).status).toBe(400);
    expect((await put({ chapters: [{ id: "nope", lessonIds: [] }], unchaptered: ids })).status).toBe(400);
    expect((await apiRequest("/api/admin/courses/nope/lessons/order", json("PUT", full))).status).toBe(404);
    // 校验失败不写库
    expect(
      (await prisma.courseLesson.findMany({ where: { courseId }, orderBy: { sortOrder: "asc" } })).map((r) => r.id),
    ).toEqual([l4, l1, l3, l2]);
  });

  it("上传签名 mock；写 videoFileId 置 PROCESSING 并清时长；刷新回填 READY / 600；无视频 → 400", async () => {
    const sig = await apiRequest("/api/admin/vod/upload-signature", { method: "POST" });
    expect(sig.status).toBe(200);
    const body = (await sig.json()) as { signature: string; expiresAt: string };
    expect(body.signature).toBe("mock-upload");
    expect(new Date(body.expiresAt).getTime()).toBeGreaterThan(Date.now());

    const courseId = await createCourse();
    const lessonId = (await post(`/api/admin/courses/${courseId}/lessons`, { title: "一" })).body?.id as string;
    const refreshEmpty = await apiRequest(`/api/admin/lessons/${lessonId}/video/refresh`, { method: "POST" });
    expect(refreshEmpty.status).toBe(400);
    expect(await refreshEmpty.json()).toMatchObject({ error: { code: "VALIDATION" } });

    await prisma.courseLesson.update({ where: { id: lessonId }, data: { durationSeconds: 42, videoStatus: "READY" } });
    expect((await apiRequest(`/api/admin/lessons/${lessonId}`, json("PATCH", { videoFileId: "file-1" }))).status).toBe(
      204,
    );
    expect(await prisma.courseLesson.findUniqueOrThrow({ where: { id: lessonId } })).toMatchObject({
      videoFileId: "file-1",
      videoStatus: "PROCESSING",
      durationSeconds: null,
    });
    expect((await apiRequest(`/api/admin/lessons/${lessonId}`, json("PATCH", { videoFileId: "" }))).status).toBe(400);

    const refreshed = await apiRequest(`/api/admin/lessons/${lessonId}/video/refresh`, { method: "POST" });
    expect(refreshed.status).toBe(200);
    expect(await refreshed.json()).toMatchObject({
      id: lessonId,
      videoFileId: "file-1",
      videoStatus: "READY",
      durationSeconds: 600,
    });
    expect((await apiRequest("/api/admin/lessons/nope/video/refresh", { method: "POST" })).status).toBe(404);
    expect((await detail(courseId)).readyCount).toBe(1);
  });

  it("按课授权：批量开通幂等、更新到期、学生不存在 400、学员列表进度、移除", async () => {
    const courseId = await createCourse();
    const l1 = (await post(`/api/admin/courses/${courseId}/lessons`, { title: "一" })).body?.id as string;
    const l2 = (await post(`/api/admin/courses/${courseId}/lessons`, { title: "二" })).body?.id as string;
    const a = await student("13900000001", "甲");
    const b = await student("13900000002", "乙");
    const c = await prisma.user.create({ data: { name: "游客丙" } });
    const grant = (body: unknown) => apiRequest(`/api/admin/courses/${courseId}/grants`, json("POST", body));

    expect((await grant({ userIds: [a.id, b.id, a.id] })).status).toBe(204);
    expect(await prisma.accessGrant.count()).toBe(2);
    const admin = await prisma.user.findFirstOrThrow({ where: { role: "ADMIN" } });
    expect(await prisma.accessGrant.findFirst({ where: { userId: a.id } })).toMatchObject({
      contentType: "COURSE",
      contentId: courseId,
      expiresAt: null,
      grantedById: admin.id,
    });
    // 重复开通幂等；不传 expiresAt 不动已有到期
    expect((await grant({ userIds: [a.id] })).status).toBe(204);
    expect(await prisma.accessGrant.count()).toBe(2);
    // 传 expiresAt：已有的更新、新的按此创建
    const expiresAt = new Date(Date.now() + 86_400_000).toISOString();
    expect((await grant({ userIds: [a.id, c.id], expiresAt })).status).toBe(204);
    expect(await prisma.accessGrant.count()).toBe(3);
    const rows = await prisma.accessGrant.findMany({ orderBy: { userId: "asc" } });
    const byUser = new Map(rows.map((r) => [r.userId, r.expiresAt?.toISOString() ?? null]));
    expect(byUser.get(a.id)).toBe(expiresAt);
    expect(byUser.get(b.id)).toBeNull();
    expect(byUser.get(c.id)).toBe(expiresAt);
    // 传 null 清到期
    expect((await grant({ userIds: [a.id], expiresAt: null })).status).toBe(204);
    expect((await prisma.accessGrant.findFirstOrThrow({ where: { userId: a.id } })).expiresAt).toBeNull();

    const bad = await grant({ userIds: [a.id, "nope"] });
    expect(bad.status).toBe(400);
    expect(await bad.json()).toMatchObject({ error: { code: "VALIDATION", message: "学生不存在：nope" } });
    expect(await prisma.accessGrant.count()).toBe(3);
    expect((await grant({ userIds: [] })).status).toBe(400);
    expect((await apiRequest("/api/admin/courses/nope/grants", json("POST", { userIds: [a.id] }))).status).toBe(404);

    // 学员列表：进度 = 已完成 / 全部课时；无进度 null
    await prisma.lessonProgress.create({ data: { userId: a.id, lessonId: l1, courseId, completed: true } });
    await prisma.lessonProgress.create({ data: { userId: a.id, lessonId: l2, courseId, positionSeconds: 3 } });
    await prisma.lessonProgress.create({ data: { userId: b.id, lessonId: l1, courseId, positionSeconds: 1 } });
    const list = (await (await apiRequest(`/api/admin/courses/${courseId}/students`)).json()) as Paged<{
      userId: string;
      name: string;
      phone: string | null;
      grantedAt: string;
      expiresAt: string | null;
      progressPercent: number | null;
      lastActiveAt: string | null;
    }>;
    expect(list.total).toBe(3);
    const item = (id: string) => list.items.find((i) => i.userId === id);
    expect(item(a.id)).toMatchObject({ name: "甲", phone: "13900000001", expiresAt: null, progressPercent: 50 });
    expect(item(a.id)?.lastActiveAt).not.toBeNull();
    expect(item(b.id)).toMatchObject({ name: "乙", phone: "13900000002", progressPercent: 0 });
    expect(item(c.id)).toMatchObject({
      name: "游客丙",
      phone: null,
      expiresAt,
      progressPercent: null,
      lastActiveAt: null,
    });
    const page2 = (await (
      await apiRequest(`/api/admin/courses/${courseId}/students?page=2&pageSize=2`)
    ).json()) as Paged<{
      userId: string;
    }>;
    expect(page2).toMatchObject({ total: 3, page: 2, pageSize: 2 });
    expect(page2.items).toHaveLength(1);
    expect((await apiRequest("/api/admin/courses/nope/students")).status).toBe(404);
    expect((await detail(courseId)).grantCount).toBe(3);

    // 移除
    expect((await apiRequest(`/api/admin/courses/${courseId}/grants/${b.id}`, { method: "DELETE" })).status).toBe(204);
    expect(await prisma.accessGrant.count({ where: { userId: b.id } })).toBe(0);
    expect((await apiRequest(`/api/admin/courses/${courseId}/grants/${b.id}`, { method: "DELETE" })).status).toBe(404);
    expect((await apiRequest(`/api/admin/courses/nope/grants/${a.id}`, { method: "DELETE" })).status).toBe(404);
    // 进度不受移除影响
    expect(await prisma.lessonProgress.count({ where: { userId: b.id } })).toBe(1);
  });

  it("概览计数：courses / readyLessons / courseGrants", async () => {
    const courseId = await createCourse();
    await prisma.courseLesson.createMany({
      data: [
        { courseId, title: "一", videoStatus: "READY", videoFileId: "f1" },
        { courseId, title: "二", videoStatus: "PROCESSING", videoFileId: "f2" },
      ],
    });
    const s = await student("13900000001");
    await prisma.accessGrant.createMany({
      data: [
        { userId: s.id, contentType: "COURSE", contentId: courseId },
        { userId: s.id, contentType: "MATERIAL", contentId: "m1" },
      ],
    });
    expect(await (await apiRequest("/api/admin/summary")).json()).toMatchObject({
      courses: 1,
      readyLessons: 1,
      courseGrants: 1,
    });
  });
});
