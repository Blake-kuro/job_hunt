import { beforeEach, describe, expect, it } from "vitest";
import app from "../app";
import { hasDb, resetDb } from "../test/db";

const post = (body: unknown) => ({
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

describe.skipIf(!hasDb)("/api/auth", () => {
  beforeEach(resetDb);

  it("未登录不能访问受保护接口", async () => {
    const res = await app.request("/api/me");
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: { code: "UNAUTHORIZED" } });
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
    expect(await me.json()).toMatchObject({ phone: "13800138000" });
  });

  it("错误验证码被拒绝，同一手机号一分钟内不能重复发送", async () => {
    await app.request("/api/auth/sms/send", post({ phone: "13900139000" }));
    const bad = await app.request("/api/auth/sms/verify", post({ phone: "13900139000", code: "000000" }));
    expect(bad.status).toBe(400);
    expect(await bad.json()).toMatchObject({ error: { code: "CODE_INVALID" } });
    const repeated = await app.request("/api/auth/sms/send", post({ phone: "13900139000" }));
    expect(repeated.status).toBe(429);
  });
});
