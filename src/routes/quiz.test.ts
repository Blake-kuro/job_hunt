import type { QuizAnswerResult, QuizBanks, QuizDashboard, QuizNext, WrongBookItem } from "../contract";
import { beforeEach, describe, expect, it } from "vitest";
import { apiRequest, guestClient, hasDb, resetDb, seedBank, seedDevUser } from "../test/db";

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
const qid = (n: number) => `tq-${String(n).padStart(3, "0")}`;

type Client = (path: string, init?: RequestInit) => Promise<Response> | Response;
const answer = (client: Client, questionId: string, picked: string[]) =>
  client("/api/quiz/attempts", post({ questionId, picked }));
const next = async (client: Client, categoryId: string) =>
  (await (await client(`/api/quiz/categories/${categoryId}/next`)).json()) as QuizNext;
const banks = async (client: Client) => (await (await client("/api/quiz/banks")).json()) as QuizBanks;
const wrongBook = async (client: Client) =>
  ((await (await client("/api/quiz/wrong-book")).json()) as { items: WrongBookItem[] }).items;

describe.skipIf(!hasDb)("/api/quiz", () => {
  let categoryId: string;
  beforeEach(async () => {
    await resetDb();
    await seedDevUser();
    ({ categoryId } = await seedBank());
  });

  it("banks：公司 → 分类，带已发布题数、作答进度与配额", async () => {
    const before = await banks(apiRequest);
    expect(before.companies).toHaveLength(1);
    expect(before.companies[0]).toMatchObject({ name: "测试公司" });
    expect(before.companies[0].categories).toEqual([
      { id: categoryId, name: "基础", total: 25, answered: 0, correct: 0 },
    ]);
    expect(before.quota).toEqual({ tier: "FREE", limit: null, used: 0 });

    await answer(apiRequest, qid(1), ["B"]);
    await answer(apiRequest, qid(2), ["A"]);
    await answer(apiRequest, qid(2), ["A"]);
    const after = await banks(apiRequest);
    expect(after.companies[0].categories[0]).toMatchObject({ answered: 2, correct: 1 });
    expect(after.quota.used).toBe(2);
  });

  it("next：按 sortOrder 给第一道未答题，index 从 1 起；不含答案", async () => {
    const first = await next(apiRequest, categoryId);
    expect(first.category).toEqual({ id: categoryId, name: "基础", company: "测试公司", total: 25 });
    expect(first.question?.id).toBe(qid(1));
    expect(first.question).toMatchObject({ type: "SINGLE", section: null, category: "基础", company: "测试公司" });
    expect(first.question).not.toHaveProperty("answer");
    expect(first).toMatchObject({ index: 1, answered: 0, exhausted: null });

    const res = await answer(apiRequest, qid(1), ["B"]);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ correct: true, answer: ["B"], accuracyRate: 100 });
    const second = await next(apiRequest, categoryId);
    expect(second.question?.id).toBe(qid(2));
    expect(second).toMatchObject({ index: 2, answered: 1, exhausted: null });
  });

  it("next：分类不存在 → 404", async () => {
    expect((await apiRequest("/api/quiz/categories/nope/next")).status).toBe(404);
  });

  it("多选按集合判题，顺序无关；答错进错题本；判断题", async () => {
    const multi = (await (await answer(apiRequest, qid(22), ["C", "A"])).json()) as QuizAnswerResult;
    expect(multi).toMatchObject({ correct: true, answer: ["A", "C"], explanation: ["解析一", "解析二"] });
    const partial = (await (await answer(apiRequest, qid(22), ["A"])).json()) as QuizAnswerResult;
    expect(partial.correct).toBe(false);
    const wrong = await wrongBook(apiRequest);
    expect(wrong).toHaveLength(1);
    expect(wrong[0]).toMatchObject({ questionId: qid(22), due: "明天" });
    expect(wrong[0].title).toHaveLength(24);

    const judge = (await (await answer(apiRequest, qid(24), ["B"])).json()) as QuizAnswerResult;
    expect(judge).toMatchObject({ correct: false, answer: ["A"] });
    const single = (await (await answer(apiRequest, qid(3), ["A", "B"])).json()) as QuizAnswerResult;
    expect(single.correct).toBe(false);
  });

  it("attempts 校验：非法 picked / 空数组 → 400；不存在的题 → 404；非法 JSON → 400", async () => {
    expect((await answer(apiRequest, qid(1), ["G"])).status).toBe(400);
    expect((await answer(apiRequest, qid(1), [])).status).toBe(400);
    expect((await answer(apiRequest, "nope", ["A"])).status).toBe(404);
    const res = await apiRequest("/api/quiz/attempts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{",
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: { code: "VALIDATION" } });
  });

  it("配额：游客答满 20 道不同题后第 21 道 403、next 为 QUOTA；重答已答题仍 200", async () => {
    const guest = guestClient();
    for (let i = 1; i <= 20; i++) {
      const n = await next(guest, categoryId);
      expect(n.question?.id).toBe(qid(i));
      expect(n.exhausted).toBeNull();
      expect((await answer(guest, qid(i), ["B"])).status).toBe(200);
    }
    const forbidden = await answer(guest, qid(21), ["B"]);
    expect(forbidden.status).toBe(403);
    expect(await forbidden.json()).toMatchObject({ error: { code: "FORBIDDEN" } });
    const done = await next(guest, categoryId);
    expect(done).toMatchObject({ question: null, exhausted: "QUOTA", index: 20, answered: 20 });
    expect((await banks(guest)).quota).toEqual({ tier: "GUEST", limit: 20, used: 20 });
    expect((await answer(guest, qid(1), ["A"])).status).toBe(200);
    expect((await banks(guest)).quota.used).toBe(20);
  });

  it("管理员不限配额；答完全部题后 next 为 ALL", async () => {
    for (let n = 1; n <= 25; n++) await answer(apiRequest, qid(n), ["B"]);
    const done = await next(apiRequest, categoryId);
    expect(done).toMatchObject({ question: null, exhausted: "ALL", index: 25, answered: 25 });
    expect((await banks(apiRequest)).companies[0].categories[0]).toMatchObject({ answered: 25, correct: 21 });
  });

  it("dashboard：打卡、本周、配额、错题；重复作答不增加累计题数", async () => {
    await answer(apiRequest, qid(1), ["A"]);
    await apiRequest(`/api/quiz/wrong-book/${qid(1)}`, put({ mastered: true }));
    await answer(apiRequest, qid(1), ["D"]);
    const body = (await (await apiRequest("/api/quiz/dashboard")).json()) as QuizDashboard;
    expect(body.streakDays).toBe(1);
    expect(body.week).toHaveLength(7);
    expect(body.week.filter((d) => d.done)).toHaveLength(1);
    expect(body).toMatchObject({ weekSolved: 1, weekTarget: 20, totalSolved: 1 });
    expect(body.quota).toEqual({ tier: "FREE", limit: null, used: 1 });
    expect(body.wrongList).toHaveLength(1);
    expect(body).not.toHaveProperty("categories");
  });

  it("wrong-book PUT mastered → 204 且从列表消失；不存在 → 404", async () => {
    await answer(apiRequest, qid(1), ["A"]);
    expect((await apiRequest(`/api/quiz/wrong-book/${qid(1)}`, put({ mastered: true }))).status).toBe(204);
    expect(await wrongBook(apiRequest)).toHaveLength(0);
    expect((await apiRequest(`/api/quiz/wrong-book/${qid(2)}`, put({ mastered: true }))).status).toBe(404);
  });

  it("旧端点 /today、/company-sets 已删除", async () => {
    expect((await apiRequest("/api/quiz/today")).status).toBe(404);
    expect((await apiRequest("/api/quiz/company-sets")).status).toBe(404);
  });
});
