import type { QuizToday, QuizDashboard, CompanySetItem, WrongBookItem } from "../contract";
import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../db";
import { apiRequest, hasDb, resetDb, seedDevUser } from "../test/db";

const LETTERS = ["A", "B", "C", "D"] as const;
const post = (body: unknown) => ({
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});
const put = (body: unknown) => ({
  method: "PUT",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

async function insertQuestions() {
  await prisma.questionCategory.create({ data: { id: "cat-1", name: "言语理解与表达" } });
  await prisma.companySet.create({ data: { id: "set-1", company: "阿里巴巴", track: "互联网 · 后端", focus: "JVM" } });
  for (const [i, answer] of (["B", "C"] as const).entries()) {
    await prisma.question.create({
      data: {
        id: `q-00${i + 1}`,
        categoryId: "cat-1",
        companySetId: i === 1 ? "set-1" : null,
        prompt: `第 ${i + 1} 题的题干，长度足够长以便测试截断到二十四个字的行为是否正确`,
        options: LETTERS.map((letter) => ({ letter, text: `选项 ${letter}` })),
        answer,
        explanation: ["解析一", "解析二"],
        difficulty: "MEDIUM",
        source: "测试",
      },
    });
  }
}

describe.skipIf(!hasDb)("/api/quiz", () => {
  beforeEach(async () => {
    await resetDb();
    await seedDevUser();
    await insertQuestions();
  });

  it("today 返回第一道未答题，不含答案", async () => {
    const body = (await (await apiRequest("/api/quiz/today")).json()) as QuizToday;
    expect(body.question?.id).toBe("q-001");
    expect(body.question).not.toHaveProperty("answer");
    expect(body.question?.options).toHaveLength(4);
    expect(body).toMatchObject({ indexLabel: "试题 1 / 20", attemptedToday: 0 });
  });

  it("答错：写 Attempt、进错题本、today 换到下一题", async () => {
    const res = await apiRequest("/api/quiz/attempts", post({ questionId: "q-001", picked: "A" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      correct: false,
      answer: "B",
      explanation: ["解析一", "解析二"],
      accuracyRate: 0,
    });
    const wrong = (await (await apiRequest("/api/quiz/wrong-book")).json()) as { items: WrongBookItem[] };
    expect(wrong.items).toHaveLength(1);
    expect(wrong.items[0]).toMatchObject({ questionId: "q-001", due: "明天" });
    expect(wrong.items[0].title).toHaveLength(24);
    const today = (await (await apiRequest("/api/quiz/today")).json()) as QuizToday;
    expect(today.question?.id).toBe("q-002");
    expect(today.indexLabel).toBe("试题 2 / 20");
  });

  it("答对：不进错题本，正确率 100", async () => {
    const body = await (await apiRequest("/api/quiz/attempts", post({ questionId: "q-002", picked: "C" }))).json();
    expect(body).toMatchObject({ correct: true, accuracyRate: 100 });
    expect(
      ((await (await apiRequest("/api/quiz/wrong-book")).json()) as { items: WrongBookItem[] }).items,
    ).toHaveLength(0);
  });

  it("attempts 校验：非法 picked → 400；不存在的题 → 404", async () => {
    expect((await apiRequest("/api/quiz/attempts", post({ questionId: "q-001", picked: "E" }))).status).toBe(400);
    expect((await apiRequest("/api/quiz/attempts", post({ questionId: "nope", picked: "A" }))).status).toBe(404);
  });

  it("dashboard：打卡、本周、分类、错题", async () => {
    await apiRequest("/api/quiz/attempts", post({ questionId: "q-001", picked: "A" }));
    const body = (await (await apiRequest("/api/quiz/dashboard")).json()) as QuizDashboard;
    expect(body.streakDays).toBe(1);
    expect(body.week).toHaveLength(7);
    expect(body.week.filter((d: { done: boolean }) => d.done)).toHaveLength(1);
    expect(body).toMatchObject({ weekSolved: 1, weekTarget: 20, totalSolved: 1 });
    expect(body.categories).toEqual([{ id: "cat-1", label: "言语理解与表达", count: 2 }]);
    expect(body.wrongList).toHaveLength(1);
  });

  it("wrong-book PUT mastered → 204 且从列表消失；不存在 → 404", async () => {
    await apiRequest("/api/quiz/attempts", post({ questionId: "q-001", picked: "A" }));
    const res = await apiRequest("/api/quiz/wrong-book/q-001", put({ mastered: true }));
    expect(res.status).toBe(204);
    expect(
      ((await (await apiRequest("/api/quiz/wrong-book")).json()) as { items: WrongBookItem[] }).items,
    ).toHaveLength(0);
    expect((await apiRequest("/api/quiz/wrong-book/q-002", put({ mastered: true }))).status).toBe(404);
  });

  it("company-sets 带题数", async () => {
    const body = (await (await apiRequest("/api/quiz/company-sets")).json()) as { items: CompanySetItem[] };
    expect(body.items).toEqual([{ id: "set-1", company: "阿里巴巴", track: "互联网 · 后端", focus: "JVM", count: 1 }]);
  });

  it("题库答完 today.question 为 null", async () => {
    await apiRequest("/api/quiz/attempts", post({ questionId: "q-001", picked: "B" }));
    await apiRequest("/api/quiz/attempts", post({ questionId: "q-002", picked: "C" }));
    const body = (await (await apiRequest("/api/quiz/today")).json()) as QuizToday;
    expect(body.question).toBeNull();
    expect(body.attemptedToday).toBe(2);
  });
  it("非法 JSON 返回统一的 400 错误", async () => {
    const res = await apiRequest("/api/quiz/attempts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{",
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: { code: "VALIDATION" } });
  });

  it("再次答错会重新激活已掌握的错题，重复作答不增加累计题数", async () => {
    await apiRequest("/api/quiz/attempts", post({ questionId: "q-001", picked: "A" }));
    await apiRequest("/api/quiz/wrong-book/q-001", put({ mastered: true }));
    await apiRequest("/api/quiz/attempts", post({ questionId: "q-001", picked: "D" }));
    const dashboard = (await (await apiRequest("/api/quiz/dashboard")).json()) as QuizDashboard;
    expect(dashboard.wrongList).toHaveLength(1);
    expect(dashboard.totalSolved).toBe(1);
    expect(dashboard.weekSolved).toBe(1);
  });
});
