import { beforeEach, describe, expect, it } from "vitest";
import type { QuizNext, QuizBanks, QuizAnswerResult } from "../contract";
import { apiRequest, guestClient, hasDb, resetDb, seedDevUser } from "../test/db";
import { jsonInit } from "../test/http";

describe.skipIf(!hasDb)("后台建题到客户端分类刷题的完整契约", () => {
  beforeEach(async () => {
    await resetDb();
    await seedDevUser();
  });
  it("创建公司分类和三种题型 → 分类选题 → 数组提交 → 进度与答完状态", async () => {
    const companyResponse = await apiRequest("/api/admin/companies", jsonInit("POST", { name: "跨端验证公司" }));
    expect(companyResponse.status).toBe(201);
    const company = (await companyResponse.json()) as { id: string };
    const categoryResponse = await apiRequest(
      "/api/admin/question-categories",
      jsonInit("POST", { companyId: company.id, name: "基础知识" }),
    );
    expect(categoryResponse.status).toBe(201);
    const category = (await categoryResponse.json()) as { id: string };
    const shapes = [
      {
        type: "SINGLE",
        options: [
          { letter: "A", text: "甲" },
          { letter: "B", text: "乙" },
        ],
        answer: "B",
        picked: ["B"],
      },
      {
        type: "MULTI",
        options: [
          { letter: "A", text: "甲" },
          { letter: "B", text: "乙" },
          { letter: "C", text: "丙" },
          { letter: "D", text: "丁" },
          { letter: "E", text: "戊" },
          { letter: "F", text: "己" },
        ],
        answer: "AF",
        picked: ["F", "A"],
      },
      {
        type: "JUDGE",
        options: [
          { letter: "A", text: "正确" },
          { letter: "B", text: "错误" },
        ],
        answer: "A",
        picked: ["A"],
      },
    ];
    for (const [index, shape] of shapes.entries()) {
      const { picked: _, ...fields } = shape;
      const response = await apiRequest(
        "/api/admin/questions",
        jsonInit("POST", {
          ...fields,
          categoryId: category.id,
          prompt: `题目 ${index}`,
          section: "第一章",
          sortOrder: index,
          explanation: ["解析"],
          difficulty: "EASY",
          source: "回归测试",
          published: true,
        }),
      );
      expect(response.status).toBe(201);
    }
    const learner = guestClient();
    const banks = (await (await learner("/api/quiz/banks")).json()) as QuizBanks;
    expect(banks.companies[0].categories[0]).toMatchObject({ id: category.id, total: 3, answered: 0 });
    for (const [index, shape] of shapes.entries()) {
      const next = (await (await learner(`/api/quiz/categories/${category.id}/next`)).json()) as QuizNext;
      expect(next.index).toBe(index + 1);
      expect(next.question).toMatchObject({ type: shape.type, section: "第一章" });
      expect(next.question).not.toHaveProperty("answer");
      const response = await learner(
        "/api/quiz/attempts",
        jsonInit("POST", { questionId: next.question?.id, picked: shape.picked }),
      );
      expect(response.status).toBe(200);
      const result = (await response.json()) as QuizAnswerResult;
      expect(result).toMatchObject({ correct: true, answer: [...shape.answer] });
    }
    const done = (await (await learner(`/api/quiz/categories/${category.id}/next`)).json()) as QuizNext;
    expect(done).toMatchObject({ question: null, exhausted: "ALL", answered: 3 });
    const updated = (await (await learner("/api/quiz/banks")).json()) as QuizBanks;
    expect(updated.companies[0].categories[0]).toMatchObject({ total: 3, answered: 3, correct: 3 });
    expect(updated.quota.used).toBe(3);
  });
});
