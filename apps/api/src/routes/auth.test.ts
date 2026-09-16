import { beforeEach, describe, expect, it } from "vitest";
import app from "../app";
import type { JobListResult } from "../contract";
import { prisma } from "../db";
import { addDays, dateKey } from "../lib/dates";
import { guestClient, hasDb, insertJobs, jobFixture, resetDb } from "../test/db";

const post = (body: unknown) => ({
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

describe.skipIf(!hasDb)("/api/auth", () => {
  beforeEach(async () => {
    await resetDb();
    await insertJobs(jobFixture(dateKey(), addDays));
  });

  it("无 Cookie 访问 → 自动成为游客并下发 device cookie", async () => {
    const res = await app.request("/api/me");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ tier: "GUEST", phone: null, plan: "FREE" });
    expect(res.headers.getSetCookie().some((c) => c.startsWith("job_hunt_device="))).toBe(true);
  });

  it("验证码首次登录会注册用户并设置会话", async () => {
    const send = await app.request("/api/auth/sms/send", post({ phone: "13800138000" }));
    expect(send.status).toBe(200);
    const { developmentCode } = (await send.json()) as { developmentCode: string };
    expect(developmentCode).toMatch(/^\d{6}$/);

    const verify = await app.request("/api/auth/sms/verify", post({ phone: "13800138000", code: developmentCode }));
    expect(verify.status).toBe(200);
    expect(await verify.json()).toMatchObject({ user: { phone: "13800138000", email: null } });
    const cookie = verify.headers.get("set-cookie");
    expect(cookie).toContain("job_hunt_session=");
    expect(cookie).toContain("HttpOnly");

    const me = await app.request("/api/me", { headers: { cookie: cookie?.split(";")[0] ?? "" } });
    expect(me.status).toBe(200);
    expect(await me.json()).toMatchObject({ phone: "13800138000", tier: "FREE" });
  });

  it("错误验证码被拒绝，同一手机号一分钟内不能重复发送", async () => {
    await app.request("/api/auth/sms/send", post({ phone: "13900139000" }));
    const bad = await app.request("/api/auth/sms/verify", post({ phone: "13900139000", code: "000000" }));
    expect(bad.status).toBe(400);
    expect(await bad.json()).toMatchObject({ error: { code: "CODE_INVALID" } });
    const repeated = await app.request("/api/auth/sms/send", post({ phone: "13900139000" }));
    expect(repeated.status).toBe(429);
  });

  it("游客登录后原有收藏保留在同一用户上；退出后回到全新游客", async () => {
    const guest = guestClient();
    expect((await guest("/api/jobs/1/favorite", { method: "PUT" })).status).toBe(200);
    const guestMe = (await (await guest("/api/me")).json()) as { id: string };

    const send = await guest("/api/auth/sms/send", post({ phone: "13700137000" }));
    const { developmentCode } = (await send.json()) as { developmentCode: string };
    const verify = await guest("/api/auth/sms/verify", post({ phone: "13700137000", code: developmentCode }));
    expect(verify.status).toBe(200);
    const me = (await (await guest("/api/me")).json()) as { id: string; tier: string };
    expect(me).toMatchObject({ id: guestMe.id, tier: "FREE" });
    const jobs = (await (await guest("/api/jobs")).json()) as JobListResult;
    expect(jobs.items.find((j) => j.id === 1)?.starred).toBe(true);

    expect((await guest("/api/auth/logout", { method: "POST" })).status).toBe(204);
    const after = (await (await guest("/api/me")).json()) as { id: string; tier: string };
    expect(after.tier).toBe("GUEST");
    expect(after.id).not.toBe(guestMe.id);
  });

  it("手机号已属于别的账号时，游客登录切换到该账号，游客数据不合并", async () => {
    const first = guestClient();
    const s1 = await first("/api/auth/sms/send", post({ phone: "13600136000" }));
    await first(
      "/api/auth/sms/verify",
      post({ phone: "13600136000", code: ((await s1.json()) as { developmentCode: string }).developmentCode }),
    );
    const owner = (await (await first("/api/me")).json()) as { id: string };

    // 绕开同手机号 60 秒发送冷却：本用例关注的是登录切换账号，不是频控。
    await prisma.smsVerification.updateMany({
      where: { phone: "13600136000" },
      data: { createdAt: new Date(Date.now() - 61_000) },
    });

    const guest = guestClient();
    await guest("/api/jobs/2/favorite", { method: "PUT" });
    const s2 = await guest("/api/auth/sms/send", post({ phone: "13600136000" }));
    await guest(
      "/api/auth/sms/verify",
      post({ phone: "13600136000", code: ((await s2.json()) as { developmentCode: string }).developmentCode }),
    );
    const me = (await (await guest("/api/me")).json()) as { id: string };
    expect(me.id).toBe(owner.id);
    const jobs = (await (await guest("/api/jobs")).json()) as JobListResult;
    expect(jobs.items.find((j) => j.id === 2)?.starred).toBe(false);
  });
});
