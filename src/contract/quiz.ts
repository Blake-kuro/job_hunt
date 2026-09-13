import { z } from "@hono/zod-openapi";

export const QuizOptionLetterSchema = z.enum(["A", "B", "C", "D"]).openapi("QuizOptionLetter");
export type QuizOptionLetter = z.infer<typeof QuizOptionLetterSchema>;

export const QuizOptionSchema = z
  .object({ letter: QuizOptionLetterSchema, text: z.string().min(1) })
  .openapi("QuizOption");
export type QuizOption = z.infer<typeof QuizOptionSchema>;

/** Question.options（Json 列）的形状：固定 4 项 */
export const quizOptionsSchema = z.array(QuizOptionSchema).length(4);

export const SubmitAttemptSchema = z
  .object({ questionId: z.string().min(1), picked: QuizOptionLetterSchema })
  .openapi("SubmitAttempt");
export type SubmitAttemptInput = z.infer<typeof SubmitAttemptSchema>;

export const SetMasteredSchema = z.object({ mastered: z.boolean() }).openapi("SetMastered");

export const QuizQuestionPublicSchema = z
  .object({
    id: z.string(),
    prompt: z.string(),
    options: z.array(QuizOptionSchema),
    category: z.string(),
    difficulty: z.string(),
    source: z.string(),
  })
  .openapi("QuizQuestionPublic");
export type QuizQuestionPublic = z.infer<typeof QuizQuestionPublicSchema>;

export const QuizTodaySchema = z
  .object({
    question: z.union([QuizQuestionPublicSchema, z.null()]),
    indexLabel: z.string(),
    attemptedToday: z.number().int(),
    date: z.string(),
  })
  .openapi("QuizToday");
export type QuizToday = z.infer<typeof QuizTodaySchema>;

export const QuizAnswerResultSchema = z
  .object({
    correct: z.boolean(),
    answer: QuizOptionLetterSchema,
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
    categories: z.array(z.object({ id: z.string(), label: z.string(), count: z.number().int() })),
    wrongList: z.array(WrongBookItemSchema),
  })
  .openapi("QuizDashboard");
export type QuizDashboard = z.infer<typeof QuizDashboardSchema>;

export const CompanySetItemSchema = z
  .object({ id: z.string(), company: z.string(), track: z.string(), focus: z.string(), count: z.number().int() })
  .openapi("CompanySetItem");
export type CompanySetItem = z.infer<typeof CompanySetItemSchema>;

export const QuestionIdParamSchema = z.object({
  questionId: z
    .string()
    .min(1)
    .openapi({ param: { name: "questionId", in: "path" }, example: "q-001" }),
});
export const WrongBookListSchema = z.object({ items: z.array(WrongBookItemSchema) }).openapi("WrongBookList");
export const CompanySetListSchema = z.object({ items: z.array(CompanySetItemSchema) }).openapi("CompanySetList");

// 兼容旧名字（service / 旧路由沿用）
export const quizOptionLetterSchema = QuizOptionLetterSchema;
export const quizOptionSchema = QuizOptionSchema;
export const submitAttemptSchema = SubmitAttemptSchema;
export const setMasteredSchema = SetMasteredSchema;
