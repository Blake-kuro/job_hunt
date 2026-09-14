import { describe, expect, it } from "vitest";
import type { AdminQuestion } from "@api/types";
import { emptyQuestionForm, fromQuestion, type QuestionFormState, toQuestionBody } from "./question-form";

const question: AdminQuestion = {
  id: "q1",
  prompt: "下列哪个不是 JavaScript 的原始类型？",
  categoryId: "cat-js",
  categoryName: "JavaScript",
  companySetId: null,
  // 后端不保证顺序：故意乱序，fromQuestion 应按字母归位
  options: [
    { letter: "C", text: "object" },
    { letter: "A", text: "string" },
    { letter: "D", text: "symbol" },
    { letter: "B", text: "number" },
  ],
  answer: "C",
  explanation: ["object 是引用类型", "其余都是原始类型"],
  difficulty: "EASY",
  source: "自编",
  published: false,
};

const filled: QuestionFormState = {
  ...emptyQuestionForm,
  prompt: "题干",
  categoryId: "cat-1",
  options: ["甲", "乙", "丙", "丁"],
  source: "来源",
};

describe("question-form", () => {
  it("按顺序校验：题干 → 分类 → 四个选项 → 来源", () => {
    expect(toQuestionBody({ ...filled, prompt: "  " })).toEqual({ ok: false, error: "请填写题干" });
    expect(toQuestionBody({ ...filled, categoryId: "" })).toEqual({ ok: false, error: "请选择分类" });
    expect(toQuestionBody({ ...filled, options: ["甲", "乙", " ", "丁"] })).toEqual({
      ok: false,
      error: "四个选项都要填写",
    });
    expect(toQuestionBody({ ...filled, source: "" })).toEqual({ ok: false, error: "请填写来源" });
  });

  it("options 带字母、explanation 按行拆分并去空、companySetId 空串 → null", () => {
    expect(
      toQuestionBody({
        ...filled,
        prompt: " 题干 ",
        options: [" 甲 ", "乙", "丙", "丁"],
        explanation: " 第一行 \n\n  \n第二行\n",
        answer: "B",
        difficulty: "HARD",
        source: " 来源 ",
        published: false,
      }),
    ).toEqual({
      ok: true,
      body: {
        prompt: "题干",
        categoryId: "cat-1",
        companySetId: null,
        options: [
          { letter: "A", text: "甲" },
          { letter: "B", text: "乙" },
          { letter: "C", text: "丙" },
          { letter: "D", text: "丁" },
        ],
        answer: "B",
        explanation: ["第一行", "第二行"],
        difficulty: "HARD",
        source: "来源",
        published: false,
      },
    });
  });

  it("companySetId 非空时原样带上", () => {
    expect(toQuestionBody({ ...filled, companySetId: "set-9" })).toMatchObject({
      ok: true,
      body: { companySetId: "set-9" },
    });
  });

  it("fromQuestion 按字母归位选项、解析用换行拼接、null 公司题集 → 空串，再往返得到原字段", () => {
    const state = fromQuestion(question);
    expect(state).toEqual({
      prompt: question.prompt,
      categoryId: "cat-js",
      companySetId: "",
      options: ["string", "number", "object", "symbol"],
      answer: "C",
      explanation: "object 是引用类型\n其余都是原始类型",
      difficulty: "EASY",
      source: "自编",
      published: false,
    });
    expect(toQuestionBody(state)).toEqual({
      ok: true,
      body: {
        prompt: question.prompt,
        categoryId: "cat-js",
        companySetId: null,
        options: [
          { letter: "A", text: "string" },
          { letter: "B", text: "number" },
          { letter: "C", text: "object" },
          { letter: "D", text: "symbol" },
        ],
        answer: "C",
        explanation: ["object 是引用类型", "其余都是原始类型"],
        difficulty: "EASY",
        source: "自编",
        published: false,
      },
    });
  });
});
