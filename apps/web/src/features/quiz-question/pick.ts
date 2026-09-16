import type { QuestionType, QuizOptionLetter } from "@entities/quiz";

/**
 * 点击选项后的新选中集合。
 * SINGLE / JUDGE：始终只保留最后点击的一项；MULTI：切换该项，并按字母排序以便展示与比对。
 */
export function togglePick(
  type: QuestionType,
  picked: QuizOptionLetter[],
  letter: QuizOptionLetter,
): QuizOptionLetter[] {
  if (type !== "MULTI") return [letter];
  return picked.includes(letter) ? picked.filter((l) => l !== letter) : [...picked, letter].sort();
}
