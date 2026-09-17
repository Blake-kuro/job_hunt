import type { AdminQuestion } from "@job-hunt/api-client/types";
import { describe, expect, it } from "vitest";
import {
  applyType,
  defaultValues,
  type FormValues,
  fromEntity,
  minOptions,
  optionsForType,
  removeOption,
  schema,
  toBody,
} from "./question-schema";

const opts = (...texts: string[]) => texts.map((text) => ({ text }));

const filled: FormValues = {
  ...defaultValues,
  prompt: "题干",
  categoryId: "cat",
  source: "来源",
  options: opts("甲", "乙", "丙", "丁"),
  answer: ["B"],
};

/** 校验失败时返回全部文案，成功时返回 [] */
function messages(values: FormValues): string[] {
  const r = schema.safeParse(values);
  return r.success ? [] : r.error.issues.map((i) => i.message);
}

/** 校验失败时返回 [路径, 文案] 列表 */
function issues(values: FormValues): [string, string][] {
  const r = schema.safeParse(values);
  return r.success ? [] : r.error.issues.map((i) => [i.path.join("."), i.message]);
}

/** 校验通过再转换；失败则抛出，便于 toMatchObject */
function parseBody(values: FormValues) {
  return toBody(schema.parse(values));
}

describe("题目表单", () => {
  it("题干、分类、来源必填", () => {
    expect(messages({ ...filled, prompt: " " })).toContain("请填写题干");
    expect(messages({ ...filled, categoryId: "" })).toContain("请选择分类");
    expect(messages({ ...filled, source: "" })).toContain("请填写来源");
  });

  it("选项至少两个、最多六个且不能有空项", () => {
    expect(messages({ ...filled, options: opts("甲"), answer: ["A"] })).toContain("至少两个选项");
    expect(messages({ ...filled, options: opts("1", "2", "3", "4", "5", "6", "7") })).toContain("最多六个选项");
    // 空项错误挂在该行输入框上；单选题选项不足两个只报数组下限，不再附带多选题文案
    expect(issues({ ...filled, options: opts("甲", " ") })).toEqual([["options.1.text", "选项不能为空"]]);
    expect(messages({ ...filled, options: opts("甲"), answer: ["A"] })).toEqual(["至少两个选项"]);
    expect(parseBody({ ...filled, options: opts("甲", "乙") })).toMatchObject({
      options: [
        { letter: "A", text: "甲" },
        { letter: "B", text: "乙" },
      ],
      answer: "B",
    });
  });

  it("单选 / 判断题必须恰好一个答案", () => {
    expect(messages({ ...filled, answer: [] })).toEqual(["请选择正确答案"]);
    expect(messages({ ...filled, answer: ["A", "B"] })).toEqual(["请选择正确答案"]);
    const judge: FormValues = {
      ...filled,
      type: "JUDGE",
      options: optionsForType("SINGLE", "JUDGE", filled.options) ?? [],
      answer: [],
    };
    expect(messages(judge)).toEqual(["请选择正确答案"]);
    expect(parseBody({ ...judge, answer: ["B"] })).toMatchObject({
      type: "JUDGE",
      options: [
        { letter: "A", text: "正确" },
        { letter: "B", text: "错误" },
      ],
      answer: "B",
    });
  });

  it("多选题至少三个选项、至少两个答案，答案排序去重后拼成字母串", () => {
    expect(messages({ ...filled, type: "MULTI", answer: ["C"] })).toEqual(["多选题至少选两个正确答案"]);
    expect(messages({ ...filled, type: "MULTI", options: opts("1", "2"), answer: ["A", "B"] })).toEqual([
      "多选题至少三个选项",
    ]);
    expect(minOptions("MULTI")).toBe(3);
    expect(minOptions("SINGLE")).toBe(2);
    expect(minOptions("JUDGE")).toBe(2);
    expect(parseBody({ ...filled, type: "MULTI", answer: ["C", "A", "C"] })).toMatchObject({
      type: "MULTI",
      answer: "AC",
    });
  });

  it("答案超出选项范围时报「请选择正确答案」", () => {
    expect(messages({ ...filled, type: "MULTI", answer: ["A", "F"] })).toEqual(["请选择正确答案"]);
    expect(messages({ ...filled, answer: ["E"] })).toEqual(["请选择正确答案"]);
  });

  it("optionsForType 切到判断题固定 正确 / 错误，切走恢复四个空选项，单选 ↔ 多选保留文案", () => {
    expect(optionsForType("SINGLE", "JUDGE", filled.options)).toEqual(opts("正确", "错误"));
    expect(optionsForType("JUDGE", "MULTI", opts("正确", "错误"))).toEqual(opts("", "", "", ""));
    expect(optionsForType("SINGLE", "MULTI", filled.options)).toBe(filled.options);
    expect(optionsForType("SINGLE", "SINGLE", filled.options)).toBeNull();
  });

  it("applyType 切题型清空答案；进出判断题换选项，单选 ↔ 多选保留选项；题型不变原样返回", () => {
    const judge = applyType(filled, "JUDGE");
    expect(judge).toMatchObject({ type: "JUDGE", options: opts("正确", "错误"), answer: [] });
    expect(applyType(judge, "SINGLE")).toMatchObject({ type: "SINGLE", options: opts("", "", "", ""), answer: [] });
    const multi = applyType(filled, "MULTI");
    expect(multi.options).toBe(filled.options);
    expect(multi.answer).toEqual([]);
    expect(applyType(filled, "SINGLE")).toBe(filled);
  });

  it("removeOption 删行后被删行的答案去掉、其后的答案前移；到下限时不删", () => {
    const multi: FormValues = { ...filled, type: "MULTI", answer: ["A", "B", "D"] };
    expect(removeOption(multi, 1)).toMatchObject({ options: opts("甲", "丙", "丁"), answer: ["A", "C"] });
    expect(removeOption(multi, 0)).toMatchObject({ options: opts("乙", "丙", "丁"), answer: ["A", "C"] });
    expect(removeOption(multi, 3)).toMatchObject({ options: opts("甲", "乙", "丙"), answer: ["A", "B"] });
    const atMin: FormValues = { ...filled, options: opts("甲", "乙"), answer: ["B"] };
    expect(removeOption(atMin, 0)).toBe(atMin);
    expect(removeOption({ ...multi, options: opts("甲", "乙", "丙") }, 2)).toMatchObject({
      options: opts("甲", "乙", "丙"),
    });
  });

  it("fromEntity 往返保留题型、所属部分、序号与答案", () => {
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
    const values = fromEntity(q);
    expect(values).toMatchObject({ type: "MULTI", section: "形势政策", sortOrder: "8", answer: ["A", "F"] });
    const body = parseBody(values);
    expect(body).toMatchObject({
      type: "MULTI",
      section: "形势政策",
      sortOrder: 8,
      answer: "AF",
      published: false,
      explanation: ["解析"],
    });
    expect(body.options.map((o) => `${o.letter}${o.text}`)).toEqual([
      "A选项A",
      "B选项B",
      "C选项C",
      "D选项D",
      "E选项E",
      "F选项F",
    ]);
  });

  it("序号非整数报错、留空则省略；所属部分与解析 trim", () => {
    expect(messages({ ...filled, sortOrder: "1.5" })).toEqual(["序号必须是整数"]);
    expect(messages({ ...filled, sortOrder: "abc" })).toEqual(["序号必须是整数"]);
    const blank = parseBody({ ...filled, sortOrder: " ", section: " ", explanation: " 一\n\n二 " });
    expect(blank).toMatchObject({ section: null, explanation: ["一", "二"] });
    expect(blank).not.toHaveProperty("sortOrder");
    expect(parseBody({ ...filled, sortOrder: "3" })).toMatchObject({ sortOrder: 3 });
  });
});
