import type { AdminQuestion, AdminQuestionBody, Difficulty, QuizOptionLetter } from "@api/types";

export const LETTERS: readonly QuizOptionLetter[] = ["A", "B", "C", "D"];

export const DIFFICULTY_LABEL: Record<Difficulty, string> = { EASY: "简单", MEDIUM: "中等", HARD: "困难" };

export type QuestionFormState = {
  prompt: string;
  categoryId: string;
  /** 空串 = 无公司题集 */
  companySetId: string;
  /** 依次对应 A–D */
  options: [string, string, string, string];
  answer: QuizOptionLetter;
  /** 每行一条解析 */
  explanation: string;
  difficulty: Difficulty;
  source: string;
  published: boolean;
};

export const emptyQuestionForm: QuestionFormState = {
  prompt: "",
  categoryId: "",
  companySetId: "",
  options: ["", "", "", ""],
  answer: "A",
  explanation: "",
  difficulty: "MEDIUM",
  source: "",
  published: true,
};

/** options 按 letter A–D 取 text（后端不保证顺序）；explanation 以换行拼接；companySetId null → "" */
export function fromQuestion(q: AdminQuestion): QuestionFormState {
  const byLetter = new Map(q.options.map((o) => [o.letter, o.text]));
  return {
    prompt: q.prompt,
    categoryId: q.categoryId,
    companySetId: q.companySetId ?? "",
    options: LETTERS.map((l) => byLetter.get(l) ?? "") as QuestionFormState["options"],
    answer: q.answer,
    explanation: q.explanation.join("\n"),
    difficulty: q.difficulty,
    source: q.source,
    published: q.published,
  };
}

/** 校验并转成请求体：题干 → 分类 → 四个选项 → 来源；解析按行拆分、trim、去空；空 companySetId → null */
export function toQuestionBody(
  s: QuestionFormState,
): { ok: true; body: AdminQuestionBody } | { ok: false; error: string } {
  const prompt = s.prompt.trim();
  if (!prompt) return { ok: false, error: "请填写题干" };
  const categoryId = s.categoryId.trim();
  if (!categoryId) return { ok: false, error: "请选择分类" };
  const texts = s.options.map((t) => t.trim());
  if (texts.some((t) => !t)) return { ok: false, error: "四个选项都要填写" };
  const source = s.source.trim();
  if (!source) return { ok: false, error: "请填写来源" };

  const companySetId = s.companySetId.trim();
  return {
    ok: true,
    body: {
      prompt,
      categoryId,
      companySetId: companySetId || null,
      options: LETTERS.map((letter, i) => ({ letter, text: texts[i] })),
      answer: s.answer,
      explanation: s.explanation
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
      difficulty: s.difficulty,
      source,
      published: s.published,
    },
  };
}
