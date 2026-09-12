import { describe, expect, it } from "vitest";
import { categoryFromSheetName, mapJobRow } from "./job-row";

const today = "2026-09-12";

const sample = {
  createTime: "2026/9/8",
  recruitmentBatch: "秋招",
  enterpriseName: "泡泡玛特",
  enterpriseNature: "民营企业",
  industry: "玩具/潮玩/文创设计",
  workLocation: "北京、上海、杭州、东莞、海外",
  position: "商业分析、商品分析、主播运营",
  graduationYear: "2027届\n\n本科及以上",
  announcementLink: "https://mp.weixin.qq.com/s/x",
  deliveryAddress: "https://popmart.zhiye.com/campus/jobs",
  deadline: "2026.11.30",
};

describe("categoryFromSheetName", () => {
  it("按关键字推断", () => {
    expect(categoryFromSheetName("央国企")).toBe(2);
    expect(categoryFromSheetName("外企名单")).toBe(3);
    expect(categoryFromSheetName("秋招与实习")).toBe(1);
    expect(categoryFromSheetName("实习")).toBe(1);
    expect(categoryFromSheetName("Sheet1")).toBeNull();
  });
});

describe("mapJobRow", () => {
  it("行内有 categoryId 优先", () => {
    const r = mapJobRow({ ...sample, categoryId: "2" }, "秋招", today);
    expect(r.ok && r.data.categoryId).toBe(2);
  });

  it("行内没有则按表名", () => {
    const r = mapJobRow(sample, "外企", today);
    expect(r.ok && r.data.categoryId).toBe(3);
  });

  it("都没有则跳过", () => {
    const r = mapJobRow(sample, "Sheet1", today);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.reason).toMatch(/分类/);
  });

  it("拆届别学历、解析截止、保留原文", () => {
    const r = mapJobRow(sample, "秋招", today);
    if (!r.ok) throw new Error(r.reason);
    expect(r.data.graduationYear).toBe("2027届");
    expect(r.data.degree).toBe("本科及以上");
    expect(r.data.deadline).toBe("2026.11.30");
    expect(r.data.deadlineAt?.toISOString()).toBe("2026-11-30T00:00:00.000Z");
    expect(r.data.createTime?.toISOString()).toBe("2026-09-07T16:00:00.000Z");
  });

  it("截止解析不了：deadlineAt 为 null", () => {
    const r = mapJobRow({ ...sample, deadline: "尽快投递，招满即止" }, "秋招", today);
    expect(r.ok && r.data.deadlineAt).toBeNull();
  });

  it("缺公司名或岗位则跳过", () => {
    expect(mapJobRow({ ...sample, enterpriseName: "" }, "秋招", today).ok).toBe(false);
    expect(mapJobRow({ ...sample, position: "" }, "秋招", today).ok).toBe(false);
  });

  it("upsert 键：id 优先，其次 serialNumber", () => {
    expect(mapJobRow({ ...sample, id: "12", serialNumber: "S1" }, "秋招", today)).toMatchObject({ key: { id: 12 } });
    expect(mapJobRow({ ...sample, serialNumber: "S1" }, "秋招", today)).toMatchObject({ key: { serialNumber: "S1" } });
    expect(mapJobRow(sample, "秋招", today)).toMatchObject({ key: {} });
  });
});
