import { describe, expect, it } from "vitest";
import type { AdminQuestion } from "@api/types";
import {
  emptyQuestionForm,
  fromQuestion,
  minOptions,
  type QuestionFormState,
  setType,
  toQuestionBody,
} from "./question-form";

const filled: QuestionFormState = {
  ...emptyQuestionForm,
  prompt: "题干",
  categoryId: "cat",
  source: "来源",
  options: ["甲", "乙", "丙", "丁"],
  answer: ["B"],
};

describe("题目表单", () => {
  it("题干、分类、来源必填，选项至少两个且不能有空项", () => {
    for (const patch of [{ prompt: " " }, { categoryId: "" }, { source: "" }])
      expect(toQuestionBody({ ...filled, ...patch }).ok).toBe(false);
    expect(toQuestionBody({ ...filled, options: ["甲"], answer: ["A"] })).toEqual({ ok: false, error: "至少两个选项" });
    expect(toQuestionBody({ ...filled, options: ["甲", " "] }).ok).toBe(false);
    expect(toQuestionBody({ ...filled, options: ["甲", "乙"] })).toMatchObject({
      ok: true,
      body: {
        options: [
          { letter: "A", text: "甲" },
          { letter: "B", text: "乙" },
        ],
        answer: "B",
      },
    });
  });

  it("单选 / 判断题必须恰好一个答案", () => {
    expect(toQuestionBody({ ...filled, answer: [] })).toEqual({ ok: false, error: "请选择正确答案" });
    expect(toQuestionBody({ ...filled, answer: ["A", "B"] })).toEqual({ ok: false, error: "请选择正确答案" });
    const judge = setType(filled, "JUDGE");
    expect(toQuestionBody(judge)).toEqual({ ok: false, error: "请选择正确答案" });
    expect(toQuestionBody({ ...judge, answer: ["B"] })).toMatchObject({
      ok: true,
      body: {
        type: "JUDGE",
        options: [
          { letter: "A", text: "正确" },
          { letter: "B", text: "错误" },
        ],
        answer: "B",
      },
    });
  });

  it("多选题至少三个选项、至少两个答案，答案排序去重后拼成字母串", () => {
    expect(toQuestionBody({ ...filled, type: "MULTI", answer: ["C"] })).toEqual({
      ok: false,
      error: "多选题至少选两个正确答案",
    });
    expect(toQuestionBody({ ...filled, type: "MULTI", options: ["1", "2"], answer: ["A", "B"] }).ok).toBe(false);
    expect(minOptions("MULTI")).toBe(3);
    expect(minOptions("SINGLE")).toBe(2);
    expect(minOptions("JUDGE")).toBe(2);
    expect(toQuestionBody({ ...filled, type: "MULTI", answer: ["C", "A", "C"] })).toMatchObject({
      ok: true,
      body: { type: "MULTI", answer: "AC" },
    });
    // 答案超出选项范围
    expect(toQuestionBody({ ...filled, type: "MULTI", answer: ["A", "F"] }).ok).toBe(false);
  });

  it("setType 切到判断题固定 正确 / 错误 并清空答案，切走恢复四个空选项", () => {
    const judge = setType(filled, "JUDGE");
    expect(judge).toMatchObject({ type: "JUDGE", options: ["正确", "错误"], answer: [] });
    expect(setType(judge, "MULTI")).toMatchObject({ type: "MULTI", options: ["", "", "", ""], answer: [] });
    // 单选 ↔ 多选之间切换保留选项文案，只清答案
    expect(setType(filled, "MULTI")).toMatchObject({ type: "MULTI", options: filled.options, answer: [] });
    expect(setType(filled, "SINGLE")).toBe(filled);
  });

  it("fromQuestion 往返保留题型、所属部分、序号与答案；序号非整数报错、留空则省略", () => {
    const q: AdminQuestion = {
      id: "q",
      companyId: "co",
      companyName: "公司",
      categoryId: "cat",
      categoryName: "分类",
      type: "MULTI",
      section: "形势政策",
      sortOrder: 8,
      prompt: "题干",
      options: ["A", "B", "C", "D", "E", "F"]
        .map((letter) => ({ letter: letter as "A", text: `选项${letter}` }))
        .reverse(),
      answer: "AF",
      explanation: ["解析"],
      difficulty: "EASY",
      source: "来源",
      published: false,
    };
    const state = fromQuestion(q);
    expect(state).toMatchObject({ type: "MULTI", section: "形势政策", sortOrder: "8", answer: ["A", "F"] });
    const result = toQuestionBody(state);
    expect(result).toMatchObject({
      ok: true,
      body: { type: "MULTI", section: "形势政策", sortOrder: 8, answer: "AF", published: false, explanation: ["解析"] },
    });
    if (result.ok)
      expect(result.body.options.map((o) => `${o.letter}${o.text}`)).toEqual([
        "A选项A",
        "B选项B",
        "C选项C",
        "D选项D",
        "E选项E",
        "F选项F",
      ]);
    expect(toQuestionBody({ ...filled, sortOrder: "1.5" }).ok).toBe(false);
    expect(toQuestionBody({ ...filled, sortOrder: "abc" }).ok).toBe(false);
    const blank = toQuestionBody({ ...filled, sortOrder: " ", section: " ", explanation: " 一\n\n二 " });
    expect(blank).toMatchObject({ ok: true, body: { section: null, explanation: ["一", "二"] } });
    if (blank.ok) expect(blank.body).not.toHaveProperty("sortOrder");
  });
});
