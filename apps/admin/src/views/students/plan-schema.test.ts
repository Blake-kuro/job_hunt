import { describe, expect, it } from "vitest";
import { fromEntity, schema, toBody } from "./plan-schema";

describe("plan-schema", () => {
  it("fromEntity 取到期时间前 10 位，null 变成空串", () => {
    expect(fromEntity({ plan: "PRO", proExpiresAt: "2026-12-31T00:00:00.000Z" })).toEqual({
      plan: "PRO",
      proExpiresAt: "2026-12-31",
    });
    expect(fromEntity({ plan: "FREE", proExpiresAt: null })).toEqual({ plan: "FREE", proExpiresAt: "" });
  });

  it("toBody：PRO 带日期转 UTC 零点；FREE 或留空 → null", () => {
    expect(toBody({ plan: "PRO", proExpiresAt: "2026-12-31" })).toEqual({
      plan: "PRO",
      proExpiresAt: "2026-12-31T00:00:00.000Z",
    });
    expect(toBody({ plan: "PRO", proExpiresAt: "" })).toEqual({ plan: "PRO", proExpiresAt: null });
    // FREE 时即使残留日期也不发送
    expect(toBody({ plan: "FREE", proExpiresAt: "2026-12-31" })).toEqual({ plan: "FREE", proExpiresAt: null });
    expect(schema.safeParse({ plan: "VIP", proExpiresAt: "" }).success).toBe(false);
  });
});
