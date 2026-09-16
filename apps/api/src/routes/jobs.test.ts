import type { JobListResult } from "../contract";
import { beforeEach, describe, expect, it } from "vitest";
import type { Prisma } from "../generated/prisma/client";
import { addDays, dateKey } from "../lib/dates";
import { apiRequest, guestClient, hasDb, insertJobs, jobFixture, resetDb, seedDevUser } from "../test/db";

const json = (body: unknown) => ({
  method: "PUT",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

const jobList = async (res: Response) => (await res.json()) as JobListResult;

describe.skipIf(!hasDb)("/api/jobs", () => {
  beforeEach(async () => {
    await resetDb();
    await seedDevUser();
    await insertJobs(jobFixture(dateKey(), addDays));
  });

  it("GET 默认按截止日升序、null 在最后", async () => {
    const res = await apiRequest("/api/jobs");
    expect(res.status).toBe(200);
    const body = await jobList(res);
    expect(body.total).toBe(3);
    expect(body.items.map((j: { id: number }) => j.id)).toEqual([1, 2, 3]);
    expect(body.items[0]).toMatchObject({
      company: "泡泡玛特",
      positions: ["产品经理", "运营"],
      cities: ["北京", "上海"],
      starred: false,
      applicationStatus: null,
    });
  });

  it("GET category / city / q 筛选", async () => {
    expect((await jobList(await apiRequest("/api/jobs?category=2"))).total).toBe(1);
    expect((await jobList(await apiRequest(`/api/jobs?city=${encodeURIComponent("深圳")}`))).total).toBe(1);
    expect((await jobList(await apiRequest(`/api/jobs?q=${encodeURIComponent("算法")}`))).items[0].id).toBe(3);
  });

  it("GET sort=posted 按发布时间倒序", async () => {
    const body = await jobList(await apiRequest("/api/jobs?sort=posted"));
    expect(body.items.map((j: { id: number }) => j.id)).toEqual([1, 3, 2]);
  });

  it("GET 分页", async () => {
    const body = await jobList(await apiRequest("/api/jobs?page=2&pageSize=2"));
    expect(body).toMatchObject({ page: 2, pageSize: 2, total: 3 });
    expect(body.items).toHaveLength(1);
  });

  it("GET 非法 category → 400 VALIDATION", async () => {
    const res = await apiRequest("/api/jobs?category=abc");
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: { code: "VALIDATION" } });
  });

  it("PUT/DELETE favorite 往返", async () => {
    expect(await (await apiRequest("/api/jobs/1/favorite", { method: "PUT" })).json()).toEqual({ starred: true });
    expect((await jobList(await apiRequest("/api/jobs"))).items[0].starred).toBe(true);
    expect(await (await apiRequest("/api/jobs/1/favorite", { method: "DELETE" })).json()).toEqual({ starred: false });
  });

  it("PUT application 写状态，DELETE 清除", async () => {
    const put = await apiRequest("/api/jobs/2/application", json({ status: "APPLIED" }));
    expect(await put.json()).toEqual({ applicationStatus: "APPLIED" });
    const del = await apiRequest("/api/jobs/2/application", { method: "DELETE" });
    expect(await del.json()).toEqual({ applicationStatus: null });
  });

  it("PUT application 非法 status → 400；不存在的 id → 404", async () => {
    expect((await apiRequest("/api/jobs/2/application", json({ status: "NOPE" }))).status).toBe(400);
    const res = await apiRequest("/api/jobs/999/favorite", { method: "PUT" });
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: { code: "NOT_FOUND" } });
  });

  it("GET progress 反映收藏与投递", async () => {
    await apiRequest("/api/jobs/1/favorite", { method: "PUT" });
    await apiRequest("/api/jobs/2/application", json({ status: "APPLIED" }));
    const body = await (await apiRequest("/api/jobs/progress")).json();
    expect(body).toMatchObject({
      starred: 1,
      applied: 1,
      interviewing: 0,
      nextDeadline: { jobId: 1, company: "泡泡玛特", daysLeft: 5 },
    });
  });
});

function manyJobs(
  n: number,
  todayKey: string,
  addDaysFn: (k: string, d: number) => string,
): Prisma.JobCreateManyInput[] {
  return Array.from({ length: n }, (_, i) => ({
    id: 100 + i,
    categoryId: (i % 3) + 1,
    enterpriseName: `公司${String(i + 1).padStart(2, "0")}`,
    position: i % 2 === 0 ? "工程师" : "运营",
    workLocation: i % 2 === 0 ? "北京" : "上海",
    deadline: addDaysFn(todayKey, i + 1),
    deadlineAt: new Date(`${addDaysFn(todayKey, i + 1)}T00:00:00Z`),
    createTime: new Date(Date.now() - i * 3_600_000),
  }));
}

describe.skipIf(!hasDb)("/api/jobs 配额", () => {
  beforeEach(async () => {
    await resetDb();
    await seedDevUser();
    await insertJobs(manyJobs(25, dateKey(), addDays));
  });

  it("游客只看到截止最近的前 20 条，且筛选在这 20 条内", async () => {
    const guest = guestClient();
    const all = await jobList(await guest("/api/jobs?pageSize=100"));
    expect(all.access).toEqual({ tier: "GUEST", visible: 20, total: 25 });
    expect(all.total).toBe(20);
    expect(all.items.map((j: { id: number }) => j.id)).toEqual(Array.from({ length: 20 }, (_, i) => 100 + i));
    const beijing = await jobList(await guest("/api/jobs?city=北京&pageSize=100"));
    expect(beijing.total).toBe(10); // 前 20 条里 id 偶数的 10 条
    const posted = await jobList(await guest("/api/jobs?sort=posted&pageSize=100"));
    expect(posted.items[0].id).toBe(100); // 排序仍在可见集合内
  });

  it("登录（FREE）看到全部 25 条（< 100）", async () => {
    const body = await jobList(await apiRequest("/api/jobs?pageSize=100"));
    expect(body.access).toEqual({ tier: "FREE", visible: 100, total: 25 });
    expect(body.total).toBe(25);
  });
});
