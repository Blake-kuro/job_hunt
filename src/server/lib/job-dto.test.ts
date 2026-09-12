import { describe, expect, it } from "vitest";
import { toJobListItem, type JobRowWithUserState } from "./job-dto";

const base: JobRowWithUserState = {
  id: 7,
  serialNumber: null,
  categoryId: 1,
  recruitmentBatch: "秋招",
  enterpriseNature: "民营企业",
  industry: "玩具/潮玩/文创设计",
  workLocation: "北京、上海、杭州",
  position: "商业分析、商品分析、主播运营",
  enterpriseName: "泡泡玛特",
  graduationYear: "2027届",
  degree: "本科及以上",
  announcementLink: "https://example.com/a",
  deliveryAddress: "https://example.com/apply",
  deadline: "2026.11.30",
  deadlineAt: new Date("2026-11-30T00:00:00Z"),
  createTime: new Date("2026-09-08T01:00:00Z"),
  updateTime: new Date("2026-09-08T01:00:00Z"),
  favorites: [],
  applications: [],
};

describe("toJobListItem", () => {
  it("拆分多值字段、算剩余天数、映射分类", () => {
    const item = toJobListItem(base, "2026-09-12");
    expect(item.company).toBe("泡泡玛特");
    expect(item.categoryLabel).toBe("秋招与实习");
    expect(item.positions).toEqual(["商业分析", "商品分析", "主播运营"]);
    expect(item.cities).toEqual(["北京", "上海", "杭州"]);
    expect(item.deadlineAt).toBe("2026-11-30");
    expect(item.daysLeft).toBe(79);
    expect(item.postedAt).toBe("2026-09-08");
    expect(item.starred).toBe(false);
    expect(item.applicationStatus).toBeNull();
  });

  it("无法解析的截止日期：deadlineAt/daysLeft 为 null，原文保留", () => {
    const item = toJobListItem({ ...base, deadline: "尽快投递，招满即止", deadlineAt: null }, "2026-09-12");
    expect(item.deadlineText).toBe("尽快投递，招满即止");
    expect(item.deadlineAt).toBeNull();
    expect(item.daysLeft).toBeNull();
  });

  it("已过期为负数", () => {
    const item = toJobListItem({ ...base, deadlineAt: new Date("2026-09-10T00:00:00Z") }, "2026-09-12");
    expect(item.daysLeft).toBe(-2);
  });

  it("带用户状态", () => {
    const item = toJobListItem(
      { ...base, favorites: [{ userId: "u1" }], applications: [{ status: "INTERVIEWING" }] },
      "2026-09-12",
    );
    expect(item.starred).toBe(true);
    expect(item.applicationStatus).toBe("INTERVIEWING");
  });
});
