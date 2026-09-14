import { beforeEach, describe, expect, it } from "vitest";
import { apiRequest, hasDb, resetDb, seedDevUser } from "../test/db";

describe.skipIf(!hasDb)("/api/me", () => {
  beforeEach(async () => {
    await resetDb();
    await seedDevUser();
  });

  it("返回开发账号", async () => {
    const res = await apiRequest("/api/me");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ email: "dev@local", name: "开发账号" });
  });

  it("未知路径 → 404 JSON", async () => {
    const res = await apiRequest("/api/nope");
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: { code: "NOT_FOUND" } });
  });
});
