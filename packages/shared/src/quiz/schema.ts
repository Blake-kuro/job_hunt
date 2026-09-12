import { z } from "zod";

export const quizOptionLetterSchema = z.enum(["A", "B", "C", "D"]);
export type QuizOptionLetter = z.infer<typeof quizOptionLetterSchema>;

export const quizOptionSchema = z.object({ letter: quizOptionLetterSchema, text: z.string().min(1) });
export type QuizOption = z.infer<typeof quizOptionSchema>;

/** Question.options（Json 列）的形状：固定 4 项 */
export const quizOptionsSchema = z.array(quizOptionSchema).length(4);

export const submitAttemptSchema = z.object({
  questionId: z.string().min(1),
  picked: quizOptionLetterSchema,
});
export type SubmitAttemptInput = z.infer<typeof submitAttemptSchema>;

export const setMasteredSchema = z.object({ mastered: z.boolean() });
