import { describe, expect, it } from "vitest";
import { quizOptionsSchema, submitAttemptSchema } from "./schema";

const four = ["A", "B", "C", "D"].map((letter) => ({ letter, text: `选项 ${letter}` }));

describe("quiz schemas", () => {
  it("options 必须恰好 4 项", () => {
    expect(quizOptionsSchema.safeParse(four).success).toBe(true);
    expect(quizOptionsSchema.safeParse(four.slice(0, 3)).success).toBe(false);
  });
  it("picked 只接受 A-D", () => {
    expect(submitAttemptSchema.safeParse({ questionId: "q-001", picked: "E" }).success).toBe(false);
    expect(submitAttemptSchema.parse({ questionId: "q-001", picked: "B" })).toEqual({
      questionId: "q-001",
      picked: "B",
    });
  });
});
