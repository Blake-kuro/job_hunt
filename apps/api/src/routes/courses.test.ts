import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import app from "../app";
import { prisma } from "../db";
import { guestClient, hasDb, resetDb, seedDevUser } from "../test/db";
import { jsonInit } from "../test/http";

type Card = {
  id: string;
  access: string;
  lessonCount: number;
  freePreviewCount: number;
  progressPercent: number | null;
};
type Lesson = {
  id: string;
  playable: boolean;
  videoStatus: string;
  progress: { positionSeconds: number; completed: boolean } | null;
};
type Detail = Card & {
  chapters: { id: string; lessons: Lesson[] }[];
  unchaptered: Lesson[];
  lastLessonId: string | null;
};

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

/** 免费课 free（1 课时 READY）、付费课 paid（章 1：试看 READY + 正式 READY；无章：处理中）、付费无试看 locked、未发布 hidden */
async function seedCourses() {
  await prisma.course.create({
    data: {
      id: "free",
      title: "免费课",
      priceCents: 0,
      published: true,
      sortOrder: 2,
      lessons: {
        create: { id: "free-1", title: "第一课", videoFileId: "mock-f1", videoStatus: "READY", durationSeconds: 100 },
      },
    },
  });
  await prisma.course.create({
    data: {
      id: "paid",
      title: "付费课",
      priceCents: 9900,
      published: true,
      sortOrder: 1,
      chapters: { create: { id: "paid-ch1", title: "第一章", sortOrder: 0 } },
    },
  });
  await prisma.courseLesson.createMany({
    data: [
      {
        id: "paid-preview",
        courseId: "paid",
        chapterId: "paid-ch1",
        title: "试看",
        sortOrder: 0,
        freePreview: true,
        videoFileId: "mock-p0",
        videoStatus: "READY",
        durationSeconds: 60,
      },
      {
        id: "paid-main",
        courseId: "paid",
        chapterId: "paid-ch1",
        title: "正式",
        sortOrder: 1,
        videoFileId: "mock-p1",
        videoStatus: "READY",
        durationSeconds: 600,
      },
      {
        id: "paid-processing",
        courseId: "paid",
        title: "处理中",
        sortOrder: 2,
        freePreview: true,
        videoFileId: "mock-p2",
        videoStatus: "PROCESSING",
      },
    ],
  });
  await prisma.course.create({
    data: {
      id: "locked",
      title: "锁定课",
      priceCents: 100,
      published: true,
      sortOrder: 3,
      lessons: { create: { id: "locked-1", title: "一", videoStatus: "NONE" } },
    },
  });
  await prisma.course.create({ data: { id: "hidden", title: "未发布", priceCents: 0, published: false } });
}

async function student(phone: string, token: string) {
  const user = await prisma.user.create({
    data: { name: "学生", identities: { create: { provider: "PHONE", providerKey: phone } } },
  });
  return { id: user.id, headers: await studentSession(user.id, token) };
}

describe.skipIf(!hasDb)("/api/courses", () => {
  beforeEach(async () => {
    await resetDb();
    await seedDevUser();
    await seedCourses();
  });

  it("目录：只列已发布、按 sortOrder；access 三态；授权后变 GRANTED，过期授权不算", async () => {
    const s = await student("13900000001", "s1");
    const list = (await (await app.request("/api/courses", { headers: s.headers })).json()) as { items: Card[] };
    expect(list.items.map((c) => [c.id, c.access])).toEqual([
      ["paid", "PREVIEW"],
      ["free", "GRANTED"],
      ["locked", "LOCKED"],
    ]);
    expect(list.items[0]).toMatchObject({ lessonCount: 3, freePreviewCount: 2, progressPercent: null });

    await prisma.accessGrant.create({
      data: { userId: s.id, contentType: "COURSE", contentId: "locked", expiresAt: new Date(Date.now() - 1000) },
    });
    await prisma.accessGrant.create({ data: { userId: s.id, contentType: "COURSE", contentId: "paid" } });
    const after = (await (await app.request("/api/courses", { headers: s.headers })).json()) as { items: Card[] };
    expect(after.items.map((c) => c.access)).toEqual(["GRANTED", "GRANTED", "LOCKED"]);
  });

  it("管理员一律 GRANTED；游客也能看目录", async () => {
    const admin = (await (
      await app.request("/api/courses", { headers: { cookie: "job_hunt_session=integration-test-session" } })
    ).json()) as { items: Card[] };
    expect(admin.items.every((c) => c.access === "GRANTED")).toBe(true);
    const guest = guestClient();
    const res = await guest("/api/courses");
    expect(res.status).toBe(200);
    expect(((await res.json()) as { items: Card[] }).items).toHaveLength(3);
  });

  it("详情：playable = READY 且（已开通或试看）；未发布 404", async () => {
    const s = await student("13900000002", "s2");
    const res = await app.request("/api/courses/paid", { headers: s.headers });
    expect(res.status).toBe(200);
    const detail = (await res.json()) as Detail;
    expect(detail.access).toBe("PREVIEW");
    expect(detail.chapters[0].lessons.map((l) => [l.id, l.playable])).toEqual([
      ["paid-preview", true],
      ["paid-main", false],
    ]);
    expect(detail.unchaptered.map((l) => [l.id, l.playable, l.videoStatus])).toEqual([
      ["paid-processing", false, "PROCESSING"],
    ]);
    expect(detail.lastLessonId).toBeNull();
    expect((await app.request("/api/courses/hidden", { headers: s.headers })).status).toBe(404);
    expect((await app.request("/api/courses/nope", { headers: s.headers })).status).toBe(404);
  });

  it("play：锁定 403、试看 200（mock 签名）、未就绪 409、课时不属于该课 404", async () => {
    const s = await student("13900000003", "s3");
    const locked = await app.request("/api/courses/paid/lessons/paid-main/play", { headers: s.headers });
    expect(locked.status).toBe(403);
    expect(await locked.json()).toMatchObject({ error: { code: "FORBIDDEN", message: "该课时需要开通课程后观看" } });

    const preview = await app.request("/api/courses/paid/lessons/paid-preview/play", { headers: s.headers });
    expect(preview.status).toBe(200);
    expect(await preview.json()).toMatchObject({ fileId: "mock-p0", psign: "mock-play", positionSeconds: 0 });

    const processing = await app.request("/api/courses/paid/lessons/paid-processing/play", { headers: s.headers });
    expect(processing.status).toBe(409);
    expect(await processing.json()).toMatchObject({ error: { code: "CONFLICT", message: "视频处理中" } });

    expect((await app.request("/api/courses/free/lessons/paid-preview/play", { headers: s.headers })).status).toBe(404);

    await prisma.accessGrant.create({ data: { userId: s.id, contentType: "COURSE", contentId: "paid" } });
    expect((await app.request("/api/courses/paid/lessons/paid-main/play", { headers: s.headers })).status).toBe(200);
  });

  it("管理员对付费课直接可播、可写进度", async () => {
    const headers = { cookie: "job_hunt_session=integration-test-session" };
    expect((await app.request("/api/courses/paid/lessons/paid-main/play", { headers })).status).toBe(200);
    const res = await app.request("/api/courses/paid/lessons/paid-main/progress", {
      ...jsonInit("PUT", { positionSeconds: 9 }),
      headers: { ...headers, "content-type": "application/json" },
    });
    expect(res.status).toBe(204);
  });

  it("progress：写入后详情 / play 带续播位置；completed 只增不减；不可播 403；越界 400", async () => {
    const s = await student("13900000004", "s4");
    const put = (lesson: string, body: unknown) =>
      app.request(`/api/courses/free/lessons/${lesson}/progress`, {
        ...jsonInit("PUT", body),
        headers: { ...s.headers, "content-type": "application/json" },
      });
    expect((await put("free-1", { positionSeconds: 30 })).status).toBe(204);
    let detail = (await (await app.request("/api/courses/free", { headers: s.headers })).json()) as Detail;
    expect(detail.unchaptered[0].progress).toEqual({ positionSeconds: 30, completed: false });
    expect(detail).toMatchObject({ lastLessonId: "free-1", progressPercent: 0 });
    const play = (await (
      await app.request("/api/courses/free/lessons/free-1/play", { headers: s.headers })
    ).json()) as { positionSeconds: number };
    expect(play.positionSeconds).toBe(30);

    expect((await put("free-1", { positionSeconds: 95, completed: true })).status).toBe(204);
    expect((await put("free-1", { positionSeconds: 5, completed: false })).status).toBe(204);
    detail = (await (await app.request("/api/courses/free", { headers: s.headers })).json()) as Detail;
    expect(detail.unchaptered[0].progress).toEqual({ positionSeconds: 5, completed: true });
    expect(detail.progressPercent).toBe(100);

    for (const bad of [-1, 7 * 24 * 3600 + 1, 2 ** 40, 1.5, "3"]) {
      const res = await put("free-1", { positionSeconds: bad });
      expect(res.status, `positionSeconds=${bad}`).toBe(400);
      expect(await res.json()).toMatchObject({ error: { code: "VALIDATION" } });
    }
    expect((await put("free-1", { positionSeconds: 7 * 24 * 3600 })).status).toBe(204);
    const forbidden = await app.request("/api/courses/paid/lessons/paid-main/progress", {
      ...jsonInit("PUT", { positionSeconds: 1 }),
      headers: { ...s.headers, "content-type": "application/json" },
    });
    expect(forbidden.status).toBe(403);
    const notReady = await app.request("/api/courses/paid/lessons/paid-processing/progress", {
      ...jsonInit("PUT", { positionSeconds: 1 }),
      headers: { ...s.headers, "content-type": "application/json" },
    });
    expect(notReady.status).toBe(403);
  });

  it("/me/courses：有授权或有进度的课，按最近学习排序，带最近课时", async () => {
    const s = await student("13900000005", "s5");
    await prisma.accessGrant.create({
      data: { userId: s.id, contentType: "COURSE", contentId: "paid", createdAt: new Date(Date.now() - 60_000) },
    });
    const empty = (await (await app.request("/api/me/courses", { headers: s.headers })).json()) as {
      items: { id: string }[];
    };
    expect(empty.items.map((c) => c.id)).toEqual(["paid"]);

    await app.request("/api/courses/free/lessons/free-1/progress", {
      ...jsonInit("PUT", { positionSeconds: 10 }),
      headers: { ...s.headers, "content-type": "application/json" },
    });
    const res = (await (await app.request("/api/me/courses", { headers: s.headers })).json()) as {
      items: { id: string; lastLessonId: string | null; lastLessonTitle: string | null; updatedAt: string }[];
    };
    expect(res.items.map((c) => [c.id, c.lastLessonId, c.lastLessonTitle])).toEqual([
      ["free", "free-1", "第一课"],
      ["paid", null, null],
    ]);
    expect(new Date(res.items[0].updatedAt).getTime()).toBeGreaterThan(new Date(res.items[1].updatedAt).getTime());

    await app.request("/api/courses/paid/lessons/paid-main/progress", {
      ...jsonInit("PUT", { positionSeconds: 3 }),
      headers: { ...s.headers, "content-type": "application/json" },
    });
    const again = (await (await app.request("/api/me/courses", { headers: s.headers })).json()) as {
      items: { id: string }[];
    };
    expect(again.items.map((c) => c.id)).toEqual(["paid", "free"]);
  });

  it("游客的试看进度在手机号登录合并后保留", async () => {
    const guest = guestClient();
    expect(
      (await guest("/api/courses/free/lessons/free-1/progress", jsonInit("PUT", { positionSeconds: 42 }))).status,
    ).toBe(204);
    const send = await guest("/api/auth/sms/send", jsonInit("POST", { phone: "13700137001" }));
    const { developmentCode } = (await send.json()) as { developmentCode: string };
    expect(
      (await guest("/api/auth/sms/verify", jsonInit("POST", { phone: "13700137001", code: developmentCode }))).status,
    ).toBe(200);
    const detail = (await (await guest("/api/courses/free")).json()) as Detail;
    expect(detail.unchaptered[0].progress).toEqual({ positionSeconds: 42, completed: false });
    const mine = (await (await guest("/api/me/courses")).json()) as { items: { id: string }[] };
    expect(mine.items.map((c) => c.id)).toEqual(["free"]);
  });
});
