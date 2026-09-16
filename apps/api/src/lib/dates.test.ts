import { describe, expect, it } from "vitest";
import {
  addDays,
  computeStreak,
  dateKey,
  daysBetween,
  dbDateToKey,
  dueLabel,
  keyToDate,
  keyToInstant,
  weekStartKey,
} from "./dates";

describe("dateKey", () => {
  it("按上海时区取日期（UTC 16:00 已是上海次日）", () => {
    expect(dateKey(new Date("2026-09-11T16:30:00Z"))).toBe("2026-09-12");
    expect(dateKey(new Date("2026-09-11T15:30:00Z"))).toBe("2026-09-11");
  });
});

describe("keyToDate / keyToInstant", () => {
  it("keyToDate 是 UTC 零点", () => {
    expect(keyToDate("2026-09-12").toISOString()).toBe("2026-09-12T00:00:00.000Z");
  });
  it("keyToInstant 是上海零点", () => {
    expect(keyToInstant("2026-09-12").toISOString()).toBe("2026-09-11T16:00:00.000Z");
  });
  it("dbDateToKey 是 keyToDate 的逆", () => {
    expect(dbDateToKey(keyToDate("2026-11-30"))).toBe("2026-11-30");
    expect(dbDateToKey(new Date("2026-09-10T00:00:00Z"))).toBe("2026-09-10");
  });
});

describe("addDays / daysBetween / weekStartKey", () => {
  it("加减天数跨月", () => {
    expect(addDays("2026-09-30", 1)).toBe("2026-10-01");
    expect(addDays("2026-10-01", -1)).toBe("2026-09-30");
  });
  it("daysBetween 为 to - from", () => {
    expect(daysBetween("2026-09-12", "2026-11-30")).toBe(79);
    expect(daysBetween("2026-09-12", "2026-09-10")).toBe(-2);
  });
  it("周一为一周起点", () => {
    expect(weekStartKey("2026-09-12")).toBe("2026-09-07"); // 周六
    expect(weekStartKey("2026-09-07")).toBe("2026-09-07"); // 周一
    expect(weekStartKey("2026-09-13")).toBe("2026-09-07"); // 周日
  });
});

describe("computeStreak", () => {
  it("今天有作答，从今天往回数", () => {
    const keys = new Set(["2026-09-12", "2026-09-11", "2026-09-10", "2026-09-08"]);
    expect(computeStreak(keys, "2026-09-12")).toBe(3);
  });
  it("今天没有但昨天有，从昨天往回数", () => {
    const keys = new Set(["2026-09-11", "2026-09-10"]);
    expect(computeStreak(keys, "2026-09-12")).toBe(2);
  });
  it("今天昨天都没有为 0", () => {
    expect(computeStreak(new Set(["2026-09-10"]), "2026-09-12")).toBe(0);
    expect(computeStreak(new Set(), "2026-09-12")).toBe(0);
  });
});

describe("dueLabel", () => {
  const today = "2026-09-12";
  it("已到期 / 今天 / 明天 / N 天后", () => {
    expect(dueLabel(keyToInstant("2026-09-10"), today)).toBe("已到期");
    expect(dueLabel(keyToInstant("2026-09-12"), today)).toBe("今天");
    expect(dueLabel(keyToInstant("2026-09-13"), today)).toBe("明天");
    expect(dueLabel(keyToInstant("2026-09-15"), today)).toBe("3 天后");
  });
});
