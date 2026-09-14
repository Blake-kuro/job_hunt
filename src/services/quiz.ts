import {
  type CompanySetItem,
  type QuizAnswerResult,
  type QuizDashboard,
  type QuizOptionLetter,
  type QuizToday,
  type WeekLabel,
  type WrongBookItem,
  quizOptionsSchema,
  quizOptionLetterSchema,
} from "../contract";
import { prisma } from "../db";
import { addDays, computeStreak, dateKey, dueLabel, keyToInstant, weekStartKey } from "../lib/dates";
import { NotFoundError } from "../lib/errors";

const DIFFICULTY_LABEL = { EASY: "难度 简单", MEDIUM: "难度 中等", HARD: "难度 困难" } as const;
const WEEK_LABELS: WeekLabel[] = ["一", "二", "三", "四", "五", "六", "日"];
const WEEK_TARGET = 20;

async function questionAccess(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { role: true, enabled: true } });
  if (!user.enabled) return { id: { in: [] as string[] } };
  if (user.role === "ADMIN") return { published: true };
  const grants = await prisma.accessGrant.findMany({
    where: { userId, contentType: "QUESTION", OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
    select: { contentId: true },
  });
  return { published: true, id: { in: grants.map((grant) => grant.contentId) } };
}

export async function getTodayQuestion(userId: string): Promise<QuizToday> {
  const today = dateKey();
  const access = await questionAccess(userId);
  const [question, attemptedToday] = await Promise.all([
    prisma.question.findFirst({
      where: { ...access, attempts: { none: { userId } } },
      orderBy: { id: "asc" },
      include: { category: { select: { name: true } } },
    }),
    prisma.attempt.count({
      where: { userId, answeredAt: { gte: keyToInstant(today), lt: keyToInstant(addDays(today, 1)) } },
    }),
  ]);

  return {
    question: question
      ? {
          id: question.id,
          prompt: question.prompt,
          options: quizOptionsSchema.parse(question.options),
          category: question.category.name,
          difficulty: DIFFICULTY_LABEL[question.difficulty],
          source: question.source,
        }
      : null,
    indexLabel: `试题 ${attemptedToday + 1} / ${WEEK_TARGET}`,
    attemptedToday,
    date: today,
  };
}

export async function submitAnswer(
  userId: string,
  questionId: string,
  picked: QuizOptionLetter,
): Promise<QuizAnswerResult> {
  const access = await questionAccess(userId);
  const q = await prisma.question.findFirst({
    where: { ...access, id: questionId },
    select: { answer: true, explanation: true },
  });
  if (!q) throw new NotFoundError(`题目 ${questionId} 不存在`);

  const correct = picked === q.answer;
  await prisma.$transaction(async (tx) => {
    await tx.attempt.create({ data: { userId, questionId, picked, correct } });
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
    answer: quizOptionLetterSchema.parse(q.answer),
    explanation: q.explanation,
    accuracyRate: total === 0 ? null : Math.round((right / total) * 100),
  };
}

export async function listWrongBook(userId: string): Promise<WrongBookItem[]> {
  const today = dateKey();
  const access = await questionAccess(userId);
  const rows = await prisma.wrongBookEntry.findMany({
    where: { userId, mastered: false, question: access },
    orderBy: { nextReviewAt: "asc" },
    select: { questionId: true, nextReviewAt: true, question: { select: { prompt: true } } },
  });
  return rows.map((r) => ({
    questionId: r.questionId,
    title: r.question.prompt.slice(0, 24),
    due: dueLabel(r.nextReviewAt, today),
  }));
}

export async function getDashboard(userId: string): Promise<QuizDashboard> {
  const today = dateKey();
  const weekStart = weekStartKey(today);

  const [attempts, weekAttempts, allSolved, categories, wrongList] = await Promise.all([
    prisma.attempt.findMany({ where: { userId }, select: { answeredAt: true } }),
    prisma.attempt.findMany({
      where: { userId, answeredAt: { gte: keyToInstant(weekStart), lt: keyToInstant(addDays(weekStart, 7)) } },
      select: { questionId: true },
      distinct: ["questionId"],
    }),
    prisma.attempt.findMany({ where: { userId }, select: { questionId: true }, distinct: ["questionId"] }),
    prisma.questionCategory.findMany({
      select: { id: true, name: true, _count: { select: { questions: true } } },
      orderBy: { id: "asc" },
    }),
    listWrongBook(userId),
  ]);

  const days = new Set(attempts.map((a) => dateKey(a.answeredAt)));
  return {
    streakDays: computeStreak(days, today),
    week: WEEK_LABELS.map((label, i) => ({ label, done: days.has(addDays(weekStart, i)) })),
    weekSolved: weekAttempts.length,
    weekTarget: WEEK_TARGET,
    totalSolved: allSolved.length,
    categories: categories.map((c) => ({ id: c.id, label: c.name, count: c._count.questions })),
    wrongList,
  };
}

export async function setMastered(userId: string, questionId: string, mastered: boolean): Promise<void> {
  const r = await prisma.wrongBookEntry.updateMany({ where: { userId, questionId }, data: { mastered } });
  if (r.count === 0) throw new NotFoundError(`错题本里没有题目 ${questionId}`);
}

export async function listCompanySets(): Promise<CompanySetItem[]> {
  const rows = await prisma.companySet.findMany({
    select: { id: true, company: true, track: true, focus: true, _count: { select: { questions: true } } },
    orderBy: { id: "asc" },
  });
  return rows.map((r) => ({ id: r.id, company: r.company, track: r.track, focus: r.focus, count: r._count.questions }));
}
