import { describe, expect, it } from "vitest";
import { LIMITS, accessFor, resolveTier } from "./access";

const now = new Date("2026-09-14T00:00:00Z");

describe("resolveTier", () => {
  it("无手机号 → GUEST", () => {
    expect(resolveTier({ plan: "FREE", proExpiresAt: null, hasPhone: false }, now)).toBe("GUEST");
  });
  it("有手机号 → FREE", () => {
    expect(resolveTier({ plan: "FREE", proExpiresAt: null, hasPhone: true }, now)).toBe("FREE");
  });
  it("PRO 永久 / 未过期 → PRO，即使没有手机号", () => {
    expect(resolveTier({ plan: "PRO", proExpiresAt: null, hasPhone: false }, now)).toBe("PRO");
    expect(resolveTier({ plan: "PRO", proExpiresAt: new Date("2026-12-31T00:00:00Z"), hasPhone: true }, now)).toBe(
      "PRO",
    );
  });
  it("PRO 已过期 → 按手机号回落", () => {
    const expired = new Date("2026-01-01T00:00:00Z");
    expect(resolveTier({ plan: "PRO", proExpiresAt: expired, hasPhone: true }, now)).toBe("FREE");
    expect(resolveTier({ plan: "PRO", proExpiresAt: expired, hasPhone: false }, now)).toBe("GUEST");
  });
});

describe("accessFor", () => {
  it("带上档位与上限", () => {
    expect(accessFor("GUEST")).toEqual({ tier: "GUEST", jobs: 20, questions: 20 });
    expect(accessFor("FREE")).toEqual({ tier: "FREE", jobs: 100, questions: 200 });
    expect(accessFor("PRO")).toEqual({ tier: "PRO", jobs: null, questions: null });
    expect(LIMITS.FREE.questions).toBe(200);
  });
});
