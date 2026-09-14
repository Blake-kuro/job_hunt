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
import type { Access } from "../lib/access";
import { addDays, computeStreak, dateKey, dueLabel, keyToInstant, weekStartKey } from "../lib/dates";
import { AppError, NotFoundError } from "../lib/errors";

const DIFFICULTY_LABEL = { EASY: "难度 简单", MEDIUM: "难度 中等", HARD: "难度 困难" } as const;
const WEEK_LABELS: WeekLabel[] = ["一", "二", "三", "四", "五", "六", "日"];
const WEEK_TARGET = 20;
type Role = "STUDENT" | "ADMIN";

/**
 * 当前用户可见的题目 id：档位窗口（已发布题按 id 升序前 access.questions 道）
 * 与该用户未过期的按题授权（AccessGrant{ contentType: QUESTION }）取并集去重。
 * null = 不限制（管理员，或 PRO 档位）。
 */
async function visibleQuestionIds(userId: string, access: Access, role: Role): Promise<string[] | null> {
  if (role === "ADMIN") return null;
  if (access.questions === null) return null;
  const [window, grants] = await Promise.all([
    prisma.question.findMany({
      where: { published: true },
      orderBy: { id: "asc" },
      take: access.questions,
      select: { id: true },
    }),
    prisma.accessGrant.findMany({
      where: { userId, contentType: "QUESTION", OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
      select: { contentId: true },
    }),
  ]);
  return [...new Set([...window.map((w) => w.id), ...grants.map((g) => g.contentId)])];
}

export async function getTodayQuestion(userId: string, access: Access, role: Role): Promise<QuizToday> {
  const today = dateKey();
  const visible = await visibleQuestionIds(userId, access, role);
  const unattempted = { attempts: { none: { userId } } } as const;
  const [question, attemptedToday] = await Promise.all([
    prisma.question.findFirst({
      where: { published: true, ...unattempted, ...(visible && { id: { in: visible } }) },
      orderBy: { id: "asc" },
      include: { category: { select: { name: true } } },
    }),
    prisma.attempt.count({
      where: { userId, answeredAt: { gte: keyToInstant(today), lt: keyToInstant(addDays(today, 1)) } },
    }),
  ]);

  let exhausted: QuizToday["exhausted"] = null;
  if (!question) {
    const anyLeft = await prisma.question.count({ where: { published: true, ...unattempted } });
    exhausted = anyLeft > 0 ? "QUOTA" : "ALL";
  }

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
    exhausted,
  };
}

export async function submitAnswer(
  userId: string,
  questionId: string,
  picked: QuizOptionLetter,
  access: Access,
  role: Role,
): Promise<QuizAnswerResult> {
  const visible = await visibleQuestionIds(userId, access, role);
  if (visible && !visible.includes(questionId)) {
    throw new AppError(403, "FORBIDDEN", "当前档位不可作答此题，登录或升级后继续");
  }
  const q = await prisma.question.findFirst({
    where: { published: true, id: questionId },
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

export async function listWrongBook(userId: string, access: Access, role: Role): Promise<WrongBookItem[]> {
  const today = dateKey();
  const visible = await visibleQuestionIds(userId, access, role);
  const rows = await prisma.wrongBookEntry.findMany({
    where: { userId, mastered: false, question: { published: true, ...(visible && { id: { in: visible } }) } },
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

  const [attempts, weekAttempts, allSolved, categories, wrongList, questionTotal] = await Promise.all([
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
    listWrongBook(userId, access, role),
    prisma.question.count({ where: { published: true } }),
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
    access: { tier: access.tier, visible: access.questions, total: questionTotal },
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
