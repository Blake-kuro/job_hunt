import type { JobListResult } from "@job-hunt/shared";
import { beforeEach, describe, expect, it } from "vitest";
import app from "../app";
import { addDays, dateKey } from "../lib/dates";
import { hasDb, insertJobs, jobFixture, resetDb, seedDevUser } from "../test/db";

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
    const res = await app.request("/api/jobs");
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
    expect((await jobList(await app.request("/api/jobs?category=2"))).total).toBe(1);
    expect((await jobList(await app.request(`/api/jobs?city=${encodeURIComponent("深圳")}`))).total).toBe(1);
    expect((await jobList(await app.request(`/api/jobs?q=${encodeURIComponent("算法")}`))).items[0].id).toBe(3);
  });

  it("GET sort=posted 按发布时间倒序", async () => {
    const body = await jobList(await app.request("/api/jobs?sort=posted"));
    expect(body.items.map((j: { id: number }) => j.id)).toEqual([1, 3, 2]);
  });

  it("GET 分页", async () => {
    const body = await jobList(await app.request("/api/jobs?page=2&pageSize=2"));
    expect(body).toMatchObject({ page: 2, pageSize: 2, total: 3 });
    expect(body.items).toHaveLength(1);
  });

  it("GET 非法 category → 400 VALIDATION", async () => {
    const res = await app.request("/api/jobs?category=abc");
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: { code: "VALIDATION" } });
  });

  it("PUT/DELETE favorite 往返", async () => {
    expect(await (await app.request("/api/jobs/1/favorite", { method: "PUT" })).json()).toEqual({ starred: true });
    expect((await jobList(await app.request("/api/jobs"))).items[0].starred).toBe(true);
    expect(await (await app.request("/api/jobs/1/favorite", { method: "DELETE" })).json()).toEqual({ starred: false });
  });

  it("PUT application 写状态，DELETE 清除", async () => {
    const put = await app.request("/api/jobs/2/application", json({ status: "APPLIED" }));
    expect(await put.json()).toEqual({ applicationStatus: "APPLIED" });
    const del = await app.request("/api/jobs/2/application", { method: "DELETE" });
    expect(await del.json()).toEqual({ applicationStatus: null });
  });

  it("PUT application 非法 status → 400；不存在的 id → 404", async () => {
    expect((await app.request("/api/jobs/2/application", json({ status: "NOPE" }))).status).toBe(400);
    const res = await app.request("/api/jobs/999/favorite", { method: "PUT" });
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: { code: "NOT_FOUND" } });
  });

  it("GET progress 反映收藏与投递", async () => {
    await app.request("/api/jobs/1/favorite", { method: "PUT" });
    await app.request("/api/jobs/2/application", json({ status: "APPLIED" }));
    const body = await (await app.request("/api/jobs/progress")).json();
    expect(body).toMatchObject({
      starred: 1,
      applied: 1,
      interviewing: 0,
      nextDeadline: { jobId: 1, company: "泡泡玛特", daysLeft: 5 },
    });
  });
});
