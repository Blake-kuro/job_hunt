import { describe, expect, it } from "vitest";
import type { AdminQuestion } from "@api/types";
import { emptyQuestionForm, fromQuestion, type QuestionFormState, toQuestionBody } from "./question-form";
const filled: QuestionFormState = {
  ...emptyQuestionForm,
  prompt: "题干",
  categoryId: "cat",
  source: "来源",
  options: ["甲", "乙", "丙", "丁"],
};
describe("公司题库表单", () => {
  it("校验题干、分类、选项及来源", () => {
    for (const patch of [{ prompt: "" }, { categoryId: "" }, { options: ["甲", ""] }, { source: "" }])
      expect(toQuestionBody({ ...filled, ...patch }).ok).toBe(false);
  });
  it("支持 2–6 个连续选项，不接受空选项", () => {
    for (const options of [
      ["甲", "乙"],
      ["1", "2", "3", "4", "5", "6"],
    ])
      expect(toQuestionBody({ ...filled, options }).ok).toBe(true);
    expect(toQuestionBody({ ...filled, options: ["1"] }).ok).toBe(false);
    expect(toQuestionBody({ ...filled, options: ["1", "2", "3", "4", "5", "6", "7"] }).ok).toBe(false);
  });
  it("多选答案排序去重，至少两个且不能超出选项", () => {
    expect(toQuestionBody({ ...filled, type: "MULTI", answer: "CACA" })).toMatchObject({
      ok: true,
      body: { answer: "AC", type: "MULTI" },
    });
    for (const answer of ["A", "AF", ""]) expect(toQuestionBody({ ...filled, type: "MULTI", answer }).ok).toBe(false);
    expect(toQuestionBody({ ...filled, type: "MULTI", options: ["1", "2"], answer: "AB" }).ok).toBe(false);
  });
  it("判断题强制固定选项，单选题禁止多个答案", () => {
    expect(toQuestionBody({ ...filled, type: "JUDGE", answer: "B" })).toMatchObject({
      ok: true,
      body: {
        options: [
          { letter: "A", text: "正确" },
          { letter: "B", text: "错误" },
        ],
        answer: "B",
      },
    });
    for (const type of ["SINGLE", "JUDGE"] as const)
      expect(toQuestionBody({ ...filled, type, answer: "AB" }).ok).toBe(false);
  });
  it("编辑六选项多选题往返保留章节排序和答案，不发送已删除的 companySetId", () => {
    const q: AdminQuestion = {
      id: "q",
      companyId: "co",
      companyName: "公司",
      categoryName: "分类",
      categoryId: "cat",
      type: "MULTI",
      section: "第一章",
      sortOrder: 8,
      prompt: "题干",
      options: ["A", "B", "C", "D", "E", "F"].map((letter) => ({ letter: letter as "A", text: letter })).reverse(),
      answer: "AF",
      explanation: ["解析"],
      difficulty: "EASY",
      source: "来源",
      published: true,
    };
    const result = toQuestionBody(fromQuestion(q));
    expect(result).toMatchObject({ ok: true, body: { type: "MULTI", section: "第一章", sortOrder: 8, answer: "AF" } });
    if (result.ok) {
      expect(result.body.options.map((o) => o.letter).join("")).toBe("ABCDEF");
      expect(result.body).not.toHaveProperty("companySetId");
    }
  });
  it("处理空章节、解析与非法排序", () => {
    expect(toQuestionBody({ ...filled, section: " ", explanation: " 一\n\n二 " })).toMatchObject({
      ok: true,
      body: { section: null, explanation: ["一", "二"] },
    });
    expect(toQuestionBody({ ...filled, sortOrder: 0.5 }).ok).toBe(false);
  });
});
