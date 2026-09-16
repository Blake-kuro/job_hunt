import type { AdminQuestion, AdminQuestionBody, Difficulty, QuestionType, QuizOptionLetter } from "@api/types";

export const LETTERS: readonly QuizOptionLetter[] = ["A", "B", "C", "D", "E", "F"];
export const MIN_OPTIONS = 2;
export const MAX_OPTIONS = 6;
/** 判断题的固定选项，与后端 validateQuestionShape 保持一致 */
export const JUDGE_OPTIONS: readonly string[] = ["正确", "错误"];

export const DIFFICULTY_LABEL: Record<Difficulty, string> = { EASY: "简单", MEDIUM: "中等", HARD: "困难" };
export const TYPE_LABEL: Record<QuestionType, string> = { SINGLE: "单选题", MULTI: "多选题", JUDGE: "判断题" };

export type QuestionFormState = {
  categoryId: string;
  type: QuestionType;
  section: string;
  /** 输入框原文；空串表示不指定，由后端默认 */
  sortOrder: string;
  prompt: string;
  /** 2–6 个选项文案，字母按下标自动为 A… */
  options: string[];
  answer: QuizOptionLetter[];
  /** 每行一条解析 */
  explanation: string;
  difficulty: Difficulty;
  source: string;
  published: boolean;
};

const blankOptions = () => ["", "", "", ""];

export const emptyQuestionForm: QuestionFormState = {
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

/** 切换题型：进出判断题时重置选项；任何切换都清空答案（答案语义随题型变） */
export function setType(state: QuestionFormState, type: QuestionType): QuestionFormState {
  if (type === state.type) return state;
  if (type === "JUDGE") return { ...state, type, options: [...JUDGE_OPTIONS], answer: [] };
  if (state.type === "JUDGE") return { ...state, type, options: blankOptions(), answer: [] };
  return { ...state, type, answer: [] };
}

export function fromQuestion(q: AdminQuestion): QuestionFormState {
  const byLetter = new Map(q.options.map((o) => [o.letter, o.text]));
  return {
    categoryId: q.categoryId,
    type: q.type,
    section: q.section ?? "",
    sortOrder: String(q.sortOrder),
    prompt: q.prompt,
    options: LETTERS.slice(0, q.options.length).map((l) => byLetter.get(l) ?? ""),
    answer: [...q.answer].filter((l): l is QuizOptionLetter => LETTERS.includes(l as QuizOptionLetter)),
    explanation: q.explanation.join("\n"),
    difficulty: q.difficulty,
    source: q.source,
    published: q.published,
  };
}

export function toQuestionBody(
  s: QuestionFormState,
): { ok: true; body: AdminQuestionBody } | { ok: false; error: string } {
  const fail = (error: string) => ({ ok: false as const, error });
  if (!s.prompt.trim()) return fail("请填写题干");
  if (!s.categoryId.trim()) return fail("请选择分类");
  const texts = s.type === "JUDGE" ? [...JUDGE_OPTIONS] : s.options.map((t) => t.trim());
  if (texts.length < MIN_OPTIONS) return fail("至少两个选项");
  if (texts.length > MAX_OPTIONS) return fail("最多六个选项");
  if (texts.some((t) => !t)) return fail("选项不能为空");
  if (s.type === "MULTI" && texts.length < 3) return fail("多选题至少三个选项");
  const valid = LETTERS.slice(0, texts.length);
  const answer = [...new Set(s.answer)].sort();
  if (answer.some((l) => !valid.includes(l))) return fail("请选择正确答案");
  if (s.type === "MULTI") {
    if (answer.length < 2) return fail("多选题至少选两个正确答案");
  } else if (answer.length !== 1) return fail("请选择正确答案");
  const sortOrderText = s.sortOrder.trim();
  const sortOrder = sortOrderText === "" ? undefined : Number(sortOrderText);
  if (sortOrder !== undefined && !Number.isInteger(sortOrder)) return fail("序号必须是整数");
  if (!s.source.trim()) return fail("请填写来源");
  return {
    ok: true,
    body: {
      categoryId: s.categoryId.trim(),
      type: s.type,
      section: s.section.trim() || null,
      ...(sortOrder === undefined ? {} : { sortOrder }),
      prompt: s.prompt.trim(),
      options: texts.map((text, i) => ({ letter: LETTERS[i], text })),
      answer: answer.join(""),
      explanation: s.explanation
        .split("\n")
        .map((p) => p.trim())
        .filter(Boolean),
      difficulty: s.difficulty,
      source: s.source.trim(),
      published: s.published,
    },
  };
}
