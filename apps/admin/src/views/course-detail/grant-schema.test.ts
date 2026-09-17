import { describe, expect, it } from "vitest";
import { parsePhones, schema, toBody } from "./grant-schema";

describe("grant-schema", () => {
  it("parsePhones 按换行 / 逗号 / 空格拆分并去重", () => {
    expect(parsePhones(" 13800000001\n13800000002, 13800000001 ，13800000003；")).toEqual([
      "13800000001",
      "13800000002",
      "13800000003",
    ]);
    expect(parsePhones("  \n ")).toEqual([]);
  });

  it("至少一个手机号；到期日期格式", () => {
    const msgs = (v: { phones: string; expiresAt: string }) => {
      const r = schema.safeParse(v);
      return r.success ? [] : r.error.issues.map((i) => i.message);
    };
    expect(msgs({ phones: " ", expiresAt: "" })).toEqual(["请至少填写一个手机号"]);
    expect(msgs({ phones: "1", expiresAt: "2026/1/1" })).toEqual(["到期日期格式为 YYYY-MM-DD"]);
    expect(msgs({ phones: "1", expiresAt: "2026-01-01" })).toEqual([]);
  });

  it("toBody：到期留空不发 expiresAt，否则按 UTC 零点", () => {
    expect(toBody(["u1"], { phones: "x", expiresAt: "" })).toEqual({ userIds: ["u1"] });
    expect(toBody(["u1", "u2"], { phones: "x", expiresAt: "2026-12-31" })).toEqual({
      userIds: ["u1", "u2"],
      expiresAt: "2026-12-31T00:00:00.000Z",
    });
  });
});
