import { describe, expect, it } from "vitest";
import { AnswerLettersSchema, quizOptionsSchema, SubmitAttemptSchema } from "./quiz";

const opts = (n: number) =>
  ["A", "B", "C", "D", "E", "F"].slice(0, n).map((letter) => ({ letter, text: `选项 ${letter}` }));

describe("quiz schemas", () => {
  it("options 2–6 项", () => {
    expect(quizOptionsSchema.safeParse(opts(2)).success).toBe(true);
    expect(quizOptionsSchema.safeParse(opts(6)).success).toBe(true);
    expect(quizOptionsSchema.safeParse(opts(1)).success).toBe(false);
    expect(quizOptionsSchema.safeParse([...opts(6), { letter: "A", text: "x" }]).success).toBe(false);
  });
  it("picked 是非空的 A–F 数组", () => {
    expect(SubmitAttemptSchema.safeParse({ questionId: "q-001", picked: ["G"] }).success).toBe(false);
    expect(SubmitAttemptSchema.safeParse({ questionId: "q-001", picked: [] }).success).toBe(false);
    expect(SubmitAttemptSchema.safeParse({ questionId: "q-001", picked: "B" }).success).toBe(false);
    expect(SubmitAttemptSchema.parse({ questionId: "q-001", picked: ["C", "A"] })).toEqual({
      questionId: "q-001",
      picked: ["C", "A"],
    });
  });
  it("answer 只接受 A–F 字母串", () => {
    expect(AnswerLettersSchema.safeParse("AC").success).toBe(true);
    expect(AnswerLettersSchema.safeParse("").success).toBe(false);
    expect(AnswerLettersSchema.safeParse("AG").success).toBe(false);
  });
});
