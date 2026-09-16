import { z } from "@hono/zod-openapi";
import { TierSchema } from "./access";

export const QuestionTypeSchema = z.enum(["SINGLE", "MULTI", "JUDGE"]).openapi("QuestionType");
export type QuestionTypeValue = z.infer<typeof QuestionTypeSchema>;

export const QuizOptionLetterSchema = z.enum(["A", "B", "C", "D", "E", "F"]).openapi("QuizOptionLetter");
export type QuizOptionLetter = z.infer<typeof QuizOptionLetterSchema>;

export const QuizOptionSchema = z
  .object({ letter: QuizOptionLetterSchema, text: z.string().min(1) })
  .openapi("QuizOption");
export type QuizOption = z.infer<typeof QuizOptionSchema>;

/** Question.options（Json 列）的形状：2–6 项 */
export const quizOptionsSchema = z.array(QuizOptionSchema).min(2).max(6);

/** Question.answer：已排序、无重复的字母串（细规则在 lib/grade.validateQuestionShape） */
export const AnswerLettersSchema = z.string().regex(/^[A-F]+$/, "答案必须是 A–F 的字母");

/** 全站作答配额：limit = 累计可作答的不同题数上限（null 不限），used = 已作答的不同题数 */
export const QuizQuotaSchema = z
  .object({ tier: TierSchema, limit: z.number().int().nullable(), used: z.number().int() })
  .openapi("QuizQuota");
export type QuizQuota = z.infer<typeof QuizQuotaSchema>;

export const SubmitAttemptSchema = z
  .object({ questionId: z.string().min(1), picked: z.array(QuizOptionLetterSchema).min(1).max(6) })
  .openapi("SubmitAttempt");
export type SubmitAttemptInput = z.infer<typeof SubmitAttemptSchema>;

export const SetMasteredSchema = z.object({ mastered: z.boolean() }).openapi("SetMastered");

export const QuizQuestionPublicSchema = z
  .object({
    id: z.string(),
    type: QuestionTypeSchema,
    section: z.string().nullable(),
    prompt: z.string(),
    options: z.array(QuizOptionSchema),
    category: z.string(),
    company: z.string(),
    difficulty: z.string(),
    source: z.string(),
  })
  .openapi("QuizQuestionPublic");
export type QuizQuestionPublic = z.infer<typeof QuizQuestionPublicSchema>;

export const QuizBanksSchema = z
  .object({
    companies: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        categories: z.array(
          z.object({
            id: z.string(),
            name: z.string(),
            total: z.number().int(),
            answered: z.number().int(),
            correct: z.number().int(),
          }),
        ),
      }),
    ),
    quota: QuizQuotaSchema,
  })
  .openapi("QuizBanks");
export type QuizBanks = z.infer<typeof QuizBanksSchema>;

export const QuizNextSchema = z
  .object({
    category: z.object({ id: z.string(), name: z.string(), company: z.string(), total: z.number().int() }),
    question: z.union([QuizQuestionPublicSchema, z.null()]),
    /** question 在分类内的序号（1 起）；无题时为 answered */
    index: z.number().int(),
    answered: z.number().int(),
    exhausted: z.enum(["QUOTA", "ALL"]).nullable(),
  })
  .openapi("QuizNext");
export type QuizNext = z.infer<typeof QuizNextSchema>;

export const QuizAnswerResultSchema = z
  .object({
    correct: z.boolean(),
    answer: z.array(QuizOptionLetterSchema),
    explanation: z.array(z.string()),
    accuracyRate: z.number().int().nullable(),
  })
  .openapi("QuizAnswerResult");
export type QuizAnswerResult = z.infer<typeof QuizAnswerResultSchema>;

export const WrongBookItemSchema = z
  .object({ questionId: z.string(), title: z.string(), due: z.string() })
  .openapi("WrongBookItem");
export type WrongBookItem = z.infer<typeof WrongBookItemSchema>;

export const WeekLabelSchema = z.enum(["一", "二", "三", "四", "五", "六", "日"]);
export type WeekLabel = z.infer<typeof WeekLabelSchema>;

export const QuizDashboardSchema = z
  .object({
    streakDays: z.number().int(),
    week: z.array(z.object({ label: WeekLabelSchema, done: z.boolean() })),
    weekSolved: z.number().int(),
    weekTarget: z.number().int(),
    totalSolved: z.number().int(),
    wrongList: z.array(WrongBookItemSchema),
    quota: QuizQuotaSchema,
  })
  .openapi("QuizDashboard");
export type QuizDashboard = z.infer<typeof QuizDashboardSchema>;

export const QuestionIdParamSchema = z.object({
  questionId: z
    .string()
    .min(1)
    .openapi({ param: { name: "questionId", in: "path" }, example: "q-001" }),
});
export const CategoryIdParamSchema = z.object({
  categoryId: z
    .string()
    .min(1)
    .openapi({ param: { name: "categoryId", in: "path" }, example: "cat-1" }),
});
export const WrongBookListSchema = z.object({ items: z.array(WrongBookItemSchema) }).openapi("WrongBookList");
