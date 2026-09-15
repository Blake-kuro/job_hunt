import {
  type QuizAnswerResult,
  type QuizBanks,
  type QuizDashboard,
  type QuizNext,
  type QuizOptionLetter,
  type QuizQuestionPublic,
  QuizOptionLetterSchema,
  type WeekLabel,
  type WrongBookItem,
  quizOptionsSchema,
} from "../contract";
import { prisma } from "../db";
import { type Access, assertQuestionQuota, quotaExhausted, quotaOf, type Role, usedQuestionQuota } from "../lib/access";
import { addDays, computeStreak, dateKey, dueLabel, keyToInstant, weekStartKey } from "../lib/dates";
import { NotFoundError } from "../lib/errors";
import { grade, normalizeAnswer } from "../lib/grade";

const DIFFICULTY_LABEL = { EASY: "难度 简单", MEDIUM: "难度 中等", HARD: "难度 困难" } as const;
const WEEK_LABELS: WeekLabel[] = ["一", "二", "三", "四", "五", "六", "日"];
const WEEK_TARGET = 20;
const ORDER = [{ sortOrder: "asc" }, { name: "asc" }] as const;

export async function listBanks(userId: string, access: Access, role: Role): Promise<QuizBanks> {
  const [companies, attempts, used] = await Promise.all([
    prisma.company.findMany({
      orderBy: [...ORDER],
      include: {
        categories: {
          orderBy: [...ORDER],
          include: { _count: { select: { questions: { where: { published: true } } } } },
        },
      },
    }),
    prisma.attempt.findMany({
      where: { userId },
      select: { questionId: true, correct: true, question: { select: { categoryId: true } } },
    }),
    usedQuestionQuota(userId),
  ]);

  // 每分类：作答过的不同题、其中有过正确作答的不同题
  const answered = new Map<string, Set<string>>();
  const correct = new Map<string, Set<string>>();
  for (const a of attempts) {
    const cat = a.question.categoryId;
    (answered.get(cat) ?? answered.set(cat, new Set()).get(cat))?.add(a.questionId);
    if (a.correct) (correct.get(cat) ?? correct.set(cat, new Set()).get(cat))?.add(a.questionId);
  }

  return {
    companies: companies.map((co) => ({
      id: co.id,
      name: co.name,
      categories: co.categories.map((cat) => ({
        id: cat.id,
        name: cat.name,
        total: cat._count.questions,
        answered: answered.get(cat.id)?.size ?? 0,
        correct: correct.get(cat.id)?.size ?? 0,
      })),
    })),
    quota: quotaOf(access, role, used),
  };
}

async function answeredInCategory(userId: string, categoryId: string): Promise<number> {
  const rows = await prisma.attempt.findMany({
    where: { userId, question: { categoryId } },
    select: { questionId: true },
    distinct: ["questionId"],
  });
  return rows.length;
}

export async function nextQuestion(userId: string, categoryId: string, access: Access, role: Role): Promise<QuizNext> {
  const category = await prisma.questionCategory.findUnique({
    where: { id: categoryId },
    include: { company: { select: { name: true } } },
  });
  if (!category) throw new NotFoundError(`分类 ${categoryId} 不存在`);

  const [total, answered, used] = await Promise.all([
    prisma.question.count({ where: { categoryId, published: true } }),
    answeredInCategory(userId, categoryId),
    usedQuestionQuota(userId),
  ]);
  const base = { category: { id: category.id, name: category.name, company: category.company.name, total }, answered };

  if (quotaExhausted(quotaOf(access, role, used))) {
    return { ...base, question: null, index: answered, exhausted: "QUOTA" };
  }
  const q = await prisma.question.findFirst({
    where: { categoryId, published: true, attempts: { none: { userId } } },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  });
  if (!q) return { ...base, question: null, index: answered, exhausted: "ALL" };

  const before = await prisma.question.count({
    where: {
      categoryId,
      published: true,
      OR: [{ sortOrder: { lt: q.sortOrder } }, { sortOrder: q.sortOrder, id: { lt: q.id } }],
    },
  });
  const question: QuizQuestionPublic = {
    id: q.id,
    type: q.type,
    section: q.section,
    prompt: q.prompt,
    options: quizOptionsSchema.parse(q.options),
    category: category.name,
    company: category.company.name,
    difficulty: DIFFICULTY_LABEL[q.difficulty],
    source: q.source,
  };
  return { ...base, question, index: before + 1, exhausted: null };
}

export async function submitAnswer(
  userId: string,
  questionId: string,
  picked: readonly QuizOptionLetter[],
  access: Access,
  role: Role,
): Promise<QuizAnswerResult> {
  const q = await prisma.question.findFirst({
    where: { published: true, id: questionId },
    select: {
      type: true,
      answer: true,
      explanation: true,
      attempts: { where: { userId }, take: 1, select: { id: true } },
    },
  });
  if (!q) throw new NotFoundError(`题目 ${questionId} 不存在`);
  // 重复作答同一题不占配额；作答新题时配额必须未用尽
  if (q.attempts.length === 0) await assertQuestionQuota(userId, access, role);

  const correct = grade(q.type, q.answer, picked);
  await prisma.$transaction(async (tx) => {
    await tx.attempt.create({ data: { userId, questionId, picked: normalizeAnswer(picked), correct } });
    if (!correct) {
      const nextReviewAt = keyToInstant(addDays(dateKey(), 1));
      await tx.wrongBookEntry.upsert({
        where: { userId_questionId: { userId, questionId } },
        update: { nextReviewAt, mastered: false },
        create: { userId, questionId, nextReviewAt },
      });
    }
  });

  const [total, right] = await Promise.all([
    prisma.attempt.count({ where: { questionId } }),
    prisma.attempt.count({ where: { questionId, correct: true } }),
  ]);

  return {
    correct,
    answer: [...q.answer].map((l) => QuizOptionLetterSchema.parse(l)),
    explanation: q.explanation,
    accuracyRate: total === 0 ? null : Math.round((right / total) * 100),
  };
}

export async function listWrongBook(userId: string): Promise<WrongBookItem[]> {
  const today = dateKey();
  const rows = await prisma.wrongBookEntry.findMany({
    where: { userId, mastered: false, question: { published: true } },
    orderBy: { nextReviewAt: "asc" },
    select: { questionId: true, nextReviewAt: true, question: { select: { prompt: true } } },
  });
  return rows.map((r) => ({
    questionId: r.questionId,
    title: r.question.prompt.slice(0, 24),
    due: dueLabel(r.nextReviewAt, today),
  }));
}

export async function getDashboard(userId: string, access: Access, role: Role): Promise<QuizDashboard> {
  const today = dateKey();
  const weekStart = weekStartKey(today);

  const [attempts, weekAttempts, used, wrongList] = await Promise.all([
    prisma.attempt.findMany({ where: { userId }, select: { answeredAt: true } }),
    prisma.attempt.findMany({
      where: { userId, answeredAt: { gte: keyToInstant(weekStart), lt: keyToInstant(addDays(weekStart, 7)) } },
      select: { questionId: true },
      distinct: ["questionId"],
    }),
    usedQuestionQuota(userId),
    listWrongBook(userId),
  ]);

  const days = new Set(attempts.map((a) => dateKey(a.answeredAt)));
  return {
    streakDays: computeStreak(days, today),
    week: WEEK_LABELS.map((label, i) => ({ label, done: days.has(addDays(weekStart, i)) })),
    weekSolved: weekAttempts.length,
    weekTarget: WEEK_TARGET,
    totalSolved: used,
    wrongList,
    quota: quotaOf(access, role, used),
  };
}

export async function setMastered(userId: string, questionId: string, mastered: boolean): Promise<void> {
  const r = await prisma.wrongBookEntry.updateMany({ where: { userId, questionId }, data: { mastered } });
  if (r.count === 0) throw new NotFoundError(`错题本里没有题目 ${questionId}`);
}
