import type { AdminQuestion, AdminQuestionBody, Difficulty, QuestionType, QuizOptionLetter } from "@api/types";
export const LETTERS: readonly QuizOptionLetter[] = ["A", "B", "C", "D", "E", "F"];
export const DIFFICULTY_LABEL: Record<Difficulty, string> = { EASY: "简单", MEDIUM: "中等", HARD: "困难" };
export const TYPE_LABEL: Record<QuestionType, string> = { SINGLE: "单选题", MULTI: "多选题", JUDGE: "判断题" };
export type QuestionFormState = {
  prompt: string;
  categoryId: string;
  type: QuestionType;
  section: string;
  sortOrder: number;
  options: string[];
  answer: string;
  explanation: string;
  difficulty: Difficulty;
  source: string;
  published: boolean;
};
export const emptyQuestionForm: QuestionFormState = {
  prompt: "",
  categoryId: "",
  type: "SINGLE",
  section: "",
  sortOrder: 0,
  options: ["", "", "", ""],
  answer: "A",
  explanation: "",
  difficulty: "MEDIUM",
  source: "",
  published: true,
};
export function fromQuestion(q: AdminQuestion): QuestionFormState {
  const byLetter = new Map(q.options.map((o) => [o.letter, o.text]));
  return {
    prompt: q.prompt,
    categoryId: q.categoryId,
    type: q.type,
    section: q.section ?? "",
    sortOrder: q.sortOrder,
    options: LETTERS.slice(0, q.options.length).map((l) => byLetter.get(l) ?? ""),
    answer: q.answer,
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
  const texts = s.type === "JUDGE" ? ["正确", "错误"] : s.options.map((t) => t.trim());
  if (texts.length < 2 || texts.length > 6 || texts.some((t) => !t)) return fail("请填写 2–6 个连续选项");
  const answer = [...new Set(s.answer)].sort().join("");
  if (!answer || [...answer].some((l) => !LETTERS.slice(0, texts.length).includes(l as QuizOptionLetter)))
    return fail("请选择有效的正确答案");
  if (s.type === "MULTI" ? texts.length < 3 || answer.length < 2 : answer.length !== 1)
    return fail(s.type === "MULTI" ? "多选题至少 3 个选项、2 个正确答案" : "单选和判断题只能有一个答案");
  if (!Number.isInteger(s.sortOrder)) return fail("排序必须是整数");
  if (!s.source.trim()) return fail("请填写来源");
  return {
    ok: true,
    body: {
      prompt: s.prompt.trim(),
      categoryId: s.categoryId.trim(),
      type: s.type,
      section: s.section.trim() || null,
      sortOrder: s.sortOrder,
      options: texts.map((text, i) => ({ letter: LETTERS[i], text })),
      answer,
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
