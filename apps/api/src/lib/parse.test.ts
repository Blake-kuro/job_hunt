import { describe, expect, it } from "vitest";
import { parseDeadline, splitGradDegree, splitMulti } from "./parse";

describe("splitMulti", () => {
  it("顿号", () => {
    expect(splitMulti("北京、上海、杭州、东莞、海外")).toEqual(["北京", "上海", "杭州", "东莞", "海外"]);
  });
  it("空格", () => {
    expect(splitMulti("昆山 厦门 黄石 成都")).toEqual(["昆山", "厦门", "黄石", "成都"]);
  });
  it("斜杠", () => {
    expect(splitMulti("玩具/潮玩/文创设计")).toEqual(["玩具", "潮玩", "文创设计"]);
  });
  it("混用 + 去重 + trim", () => {
    expect(splitMulti(" 北京 ，上海、北京 | 深圳 ")).toEqual(["北京", "上海", "深圳"]);
  });
  it("空值", () => {
    expect(splitMulti("")).toEqual([]);
    expect(splitMulti(null)).toEqual([]);
    expect(splitMulti(undefined)).toEqual([]);
  });
});

describe("parseDeadline", () => {
  const today = "2026-09-12";
  it("带年份的各种写法", () => {
    expect(parseDeadline("2026.11.30", today)).toBe("2026-11-30");
    expect(parseDeadline("2026/11/30", today)).toBe("2026-11-30");
    expect(parseDeadline("2026-11-30", today)).toBe("2026-11-30");
    expect(parseDeadline("2026年11月30日", today)).toBe("2026-11-30");
    expect(parseDeadline("2026/9/8", today)).toBe("2026-09-08");
  });
  it("不带年份：默认当年", () => {
    expect(parseDeadline("11.30", today)).toBe("2026-11-30");
    expect(parseDeadline("11月30日", today)).toBe("2026-11-30");
  });
  it("不带年份且早于今天 180 天以上：视为次年", () => {
    expect(parseDeadline("1.15", today)).toBe("2027-01-15");
  });
  it("不带年份且在 180 天内的过去：仍是当年（刚过期）", () => {
    expect(parseDeadline("9.1", today)).toBe("2026-09-01");
  });
  it("解析不了的返回 null", () => {
    expect(parseDeadline("尽快投递，招满即止", today)).toBeNull();
    expect(parseDeadline("长期有效", today)).toBeNull();
    expect(parseDeadline("", today)).toBeNull();
    expect(parseDeadline(null, today)).toBeNull();
  });
  it("前后带说明文字也能提取", () => {
    expect(parseDeadline("截止 2026.11.30 前", today)).toBe("2026-11-30");
  });
});

describe("splitGradDegree", () => {
  it("换行分隔的届别 + 学历", () => {
    expect(splitGradDegree("2027届\n\n本科及以上")).toEqual({ graduationYear: "2027届", degree: "本科及以上" });
    expect(splitGradDegree("2026/2027届\n\n本科及以上")).toEqual({
      graduationYear: "2026/2027届",
      degree: "本科及以上",
    });
  });
  it("只有一项", () => {
    expect(splitGradDegree("2027届")).toEqual({ graduationYear: "2027届", degree: null });
    expect(splitGradDegree("本科及以上")).toEqual({ graduationYear: null, degree: "本科及以上" });
    expect(splitGradDegree("硕士")).toEqual({ graduationYear: null, degree: "硕士" });
    expect(splitGradDegree("学历不限")).toEqual({ graduationYear: null, degree: "学历不限" });
  });
  it("空值", () => {
    expect(splitGradDegree("")).toEqual({ graduationYear: null, degree: null });
    expect(splitGradDegree(null)).toEqual({ graduationYear: null, degree: null });
  });
});
