import { describe, expect, it } from "vitest";
import { grade, JUDGE_OPTIONS, normalizeAnswer, validateQuestionShape } from "./grade";

const opts = (n: number) =>
  ["A", "B", "C", "D", "E", "F"].slice(0, n).map((letter) => ({ letter, text: `选项 ${letter}` }));

describe("normalizeAnswer", () => {
  it("去重、排序、拼接", () => {
    expect(normalizeAnswer(["C", "A", "A"])).toBe("AC");
    expect(normalizeAnswer([])).toBe("");
  });
});

describe("grade", () => {
  it("多选按集合相等，顺序无关", () => {
    expect(grade("MULTI", "AC", ["C", "A"])).toBe(true);
    expect(grade("MULTI", "AC", ["A"])).toBe(false);
    expect(grade("MULTI", "AC", ["A", "C", "D"])).toBe(false);
  });
  it("单选 / 判断只接受恰好一个字母", () => {
    expect(grade("SINGLE", "B", ["B"])).toBe(true);
    expect(grade("SINGLE", "B", ["A", "B"])).toBe(false);
    expect(grade("SINGLE", "B", ["B", "B"])).toBe(false);
    expect(grade("JUDGE", "A", ["A"])).toBe(true);
    expect(grade("JUDGE", "A", ["B"])).toBe(false);
  });
});

describe("validateQuestionShape", () => {
  it("非法形状返回错误文案", () => {
    expect(
      validateQuestionShape(
        "SINGLE",
        [
          { letter: "B", text: "x" },
          { letter: "C", text: "y" },
        ],
        "B",
      ),
    ).toBe("选项字母必须从 A 起连续");
    expect(
      validateQuestionShape(
        "SINGLE",
        [
          { letter: "A", text: " " },
          { letter: "B", text: "y" },
        ],
        "A",
      ),
    ).toBe("选项内容不能为空");
    expect(validateQuestionShape("MULTI", opts(4), "CA")).toBe("答案必须是已排序且不重复的字母");
    expect(validateQuestionShape("SINGLE", opts(4), "E")).toBe("答案包含不存在的选项");
    expect(validateQuestionShape("SINGLE", opts(4), "AB")).toBe("单选题只能有一个答案");
    expect(validateQuestionShape("MULTI", opts(4), "A")).toBe("多选题至少 3 个选项、2 个正确答案");
    expect(validateQuestionShape("MULTI", opts(2), "AB")).toBe("多选题至少 3 个选项、2 个正确答案");
    expect(validateQuestionShape("SINGLE", opts(1), "A")).toBe("选项数量需在 2–6 之间");
    expect(validateQuestionShape("JUDGE", opts(2), "A")).toBe("判断题选项必须是 A 正确 / B 错误");
    expect(validateQuestionShape("JUDGE", JUDGE_OPTIONS, "AB")).toBe("判断题只能有一个答案");
  });
  it("合法形状返回 null", () => {
    expect(validateQuestionShape("SINGLE", opts(4), "B")).toBeNull();
    expect(validateQuestionShape("MULTI", opts(6), "ABF")).toBeNull();
    expect(validateQuestionShape("JUDGE", JUDGE_OPTIONS, "B")).toBeNull();
  });
});
