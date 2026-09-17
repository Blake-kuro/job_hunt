import type {
  AdminQuestion,
  AdminQuestionBody,
  Difficulty,
  QuestionType,
  QuizOptionLetter,
} from "@job-hunt/api-client/types";
import { z } from "zod";

export const LETTERS: readonly QuizOptionLetter[] = ["A", "B", "C", "D", "E", "F"];
export const MIN_OPTIONS = 2;
export const MAX_OPTIONS = 6;
/** 各题型的选项下限：多选题至少 3 个，其余 2 个（表单删除按钮与校验共用） */
export const minOptions = (type: QuestionType) => (type === "MULTI" ? 3 : MIN_OPTIONS);
/** 判断题的固定选项，与后端 validateQuestionShape 保持一致 */
export const JUDGE_OPTIONS: readonly string[] = ["正确", "错误"];

export const DIFFICULTY_LABEL: Record<Difficulty, string> = { EASY: "简单", MEDIUM: "中等", HARD: "困难" };
export const TYPE_LABEL: Record<QuestionType, string> = { SINGLE: "单选题", MULTI: "多选题", JUDGE: "判断题" };

const letter = z.enum(["A", "B", "C", "D", "E", "F"]);

/**
 * 题目表单。选项是 `{ text }` 对象数组（react-hook-form 的 useFieldArray 不支持纯字符串数组），
 * 字母按下标自动为 A…；跨字段规则（按题型校验选项 / 答案）在 superRefine 里，文案与原 toQuestionBody 一致。
 */
export const schema = z
  .object({
    categoryId: z.string().trim().min(1, "请选择分类"),
    type: z.enum(["SINGLE", "MULTI", "JUDGE"]),
    section: z.string(),
    /** 输入框原文；空串表示不指定，由后端默认 */
    sortOrder: z.string(),
    prompt: z.string().trim().min(1, "请填写题干"),
    options: z
      .array(z.object({ text: z.string() }))
      .min(MIN_OPTIONS, "至少两个选项")
      .max(MAX_OPTIONS, "最多六个选项"),
    answer: z.array(letter),
    /** 每行一条解析 */
    explanation: z.string(),
    difficulty: z.enum(["EASY", "MEDIUM", "HARD"]),
    source: z.string().trim().min(1, "请填写来源"),
    published: z.boolean(),
  })
  .superRefine((v, ctx) => {
    const texts = optionTexts(v);
    const blank = texts.flatMap((t, i) => (t ? [] : [i]));
    // 空项错误挂在对应行的输入框下；行数下限（数组 .min 之外只有多选题需要）挂在数组根
    for (const i of blank) ctx.addIssue({ code: "custom", path: ["options", i, "text"], message: "选项不能为空" });
    if (blank.length === 0 && v.type === "MULTI" && texts.length < minOptions("MULTI"))
      ctx.addIssue({ code: "custom", path: ["options"], message: "多选题至少三个选项" });

    const valid = LETTERS.slice(0, texts.length);
    const answer = normalizeAnswer(v.answer);
    if (answer.some((l) => !valid.includes(l)))
      ctx.addIssue({ code: "custom", path: ["answer"], message: "请选择正确答案" });
    else if (v.type === "MULTI") {
      if (answer.length < 2) ctx.addIssue({ code: "custom", path: ["answer"], message: "多选题至少选两个正确答案" });
    } else if (answer.length !== 1) ctx.addIssue({ code: "custom", path: ["answer"], message: "请选择正确答案" });

    const sortOrder = parseSortOrder(v.sortOrder);
    if (sortOrder !== undefined && !Number.isInteger(sortOrder))
      ctx.addIssue({ code: "custom", path: ["sortOrder"], message: "序号必须是整数" });
  });

export type FormValues = z.infer<typeof schema>;

export const blankOptions = (): FormValues["options"] => [{ text: "" }, { text: "" }, { text: "" }, { text: "" }];
export const judgeOptions = (): FormValues["options"] => JUDGE_OPTIONS.map((text) => ({ text }));

export const defaultValues: FormValues = {
  categoryId: "",
  type: "SINGLE",
  section: "",
  sortOrder: "",
  prompt: "",
  options: blankOptions(),
  answer: [],
  explanation: "",
  difficulty: "MEDIUM",
  source: "",
  published: true,
};

/** 判断题固定用 正确 / 错误；其余取输入并 trim */
function optionTexts(v: Pick<FormValues, "type" | "options">): string[] {
  return v.type === "JUDGE" ? [...JUDGE_OPTIONS] : v.options.map((o) => o.text.trim());
}

/** 答案去重后按字母排序 */
function normalizeAnswer(answer: FormValues["answer"]): QuizOptionLetter[] {
  return [...new Set(answer)].sort();
}

function parseSortOrder(text: string): number | undefined {
  const trimmed = text.trim();
  return trimmed === "" ? undefined : Number(trimmed);
}

/**
 * 切换题型后的选项 / 答案：进出判断题时重置选项；任何切换都清空答案（答案语义随题型变）。
 * 返回 null 表示题型未变，不用动。
 */
export function optionsForType(
  from: QuestionType,
  to: QuestionType,
  options: FormValues["options"],
): FormValues["options"] | null {
  if (from === to) return null;
  if (to === "JUDGE") return judgeOptions();
  if (from === "JUDGE") return blankOptions();
  return options;
}

/** 切换题型后的表单值：进出判断题时重置选项；任何切换都清空答案（答案语义随题型变）。题型未变则原样返回。 */
export function applyType(values: FormValues, type: QuestionType): FormValues {
  const options = optionsForType(values.type, type, values.options);
  if (!options) return values;
  return { ...values, type, options, answer: [] };
}

/**
 * 删掉一行后字母重新排：被删行的答案去掉，其后的答案往前挪一位。
 * 行数已到该题型下限时不删，原样返回。
 */
export function removeOption(values: FormValues, index: number): FormValues {
  if (values.options.length <= minOptions(values.type) || index < 0 || index >= values.options.length) return values;
  return {
    ...values,
    options: values.options.filter((_, i) => i !== index),
    answer: values.answer
      .map((l) => LETTERS.indexOf(l))
      .filter((i) => i !== index)
      .map((i) => LETTERS[i > index ? i - 1 : i]),
  };
}

export function fromEntity(q: AdminQuestion): FormValues {
  const byLetter = new Map(q.options.map((o) => [o.letter, o.text]));
  return {
    categoryId: q.categoryId,
    type: q.type,
    section: q.section ?? "",
    sortOrder: String(q.sortOrder),
    prompt: q.prompt,
    options: LETTERS.slice(0, q.options.length).map((l) => ({ text: byLetter.get(l) ?? "" })),
    answer: [...q.answer].filter((l): l is QuizOptionLetter => LETTERS.includes(l as QuizOptionLetter)),
    explanation: q.explanation.join("\n"),
    difficulty: q.difficulty,
    source: q.source,
    published: q.published,
  };
}

/** 校验通过的表单值 → 请求体：序号留空则省略字段；解析按行拆分 */
export function toBody(v: FormValues): AdminQuestionBody {
  const sortOrder = parseSortOrder(v.sortOrder);
  return {
    categoryId: v.categoryId.trim(),
    type: v.type,
    section: v.section.trim() || null,
    ...(sortOrder === undefined ? {} : { sortOrder }),
    prompt: v.prompt.trim(),
    options: optionTexts(v).map((text, i) => ({ letter: LETTERS[i], text })),
    answer: normalizeAnswer(v.answer).join(""),
    explanation: v.explanation
      .split("\n")
      .map((p) => p.trim())
      .filter(Boolean),
    difficulty: v.difficulty,
    source: v.source.trim(),
    published: v.published,
  };
}
