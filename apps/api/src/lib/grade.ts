import type { QuestionType } from "../generated/prisma/enums";

export const LETTERS = ["A", "B", "C", "D", "E", "F"] as const;
export type Letter = (typeof LETTERS)[number];
export interface OptionShape {
  letter: string;
  text: string;
}
/** 判断题固定选项 */
export const JUDGE_OPTIONS: OptionShape[] = [
  { letter: "A", text: "正确" },
  { letter: "B", text: "错误" },
];

/** 去重、按字母排序、拼成 "ABC" */
export function normalizeAnswer(letters: readonly string[]): string {
  return [...new Set(letters)].sort().join("");
}

/** 判题：多选按集合相等；单选 / 判断要求恰好选一个且相等 */
export function grade(type: QuestionType, answer: string, picked: readonly string[]): boolean {
  const p = normalizeAnswer(picked);
  if (type === "MULTI") return p === answer;
  return picked.length === 1 && p === answer;
}

/** 校验题目形状（后台编辑与导入共用）；返回错误文案，null = 合法 */
export function validateQuestionShape(
  type: QuestionType,
  options: readonly OptionShape[],
  answer: string,
): string | null {
  const letters = options.map((o) => o.letter);
  if (letters.some((l, i) => l !== LETTERS[i])) return "选项字母必须从 A 起连续";
  if (options.some((o) => !o.text.trim())) return "选项内容不能为空";
  if (!/^[A-F]+$/.test(answer) || normalizeAnswer([...answer]) !== answer) return "答案必须是已排序且不重复的字母";
  if ([...answer].some((l) => !letters.includes(l))) return "答案包含不存在的选项";
  if (type === "JUDGE") {
    if (options.length !== 2 || options[0].text !== "正确" || options[1].text !== "错误") {
      return "判断题选项必须是 A 正确 / B 错误";
    }
    if (answer.length !== 1) return "判断题只能有一个答案";
    return null;
  }
  if (options.length < 2 || options.length > 6) return "选项数量需在 2–6 之间";
  if (type === "SINGLE" && answer.length !== 1) return "单选题只能有一个答案";
  if (type === "MULTI" && (options.length < 3 || answer.length < 2)) return "多选题至少 3 个选项、2 个正确答案";
  return null;
}
