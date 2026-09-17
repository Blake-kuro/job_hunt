import { afterEach, describe, expect, it, vi } from "vitest";
import { client } from "@job-hunt/api-client/client";
import { quizBanksQuery, quizNextQuery } from "./queries";

afterEach(() => vi.restoreAllMocks());
describe("公司分类接口", () => {
  it("读取 banks 而非旧 company-sets", async () => {
    const data = { companies: [], quota: { tier: "GUEST", used: 0, limit: 20 } };
    const get = vi.spyOn(client, "GET").mockResolvedValue({ data, response: new Response() });
    const q = quizBanksQuery();
    await expect(q.queryFn?.({} as never)).resolves.toEqual(data);
    expect(get).toHaveBeenCalledWith("/api/quiz/banks");
  });
  it("按分类隔离缓存并发送路径参数，不使用 today", async () => {
    const get = vi
      .spyOn(client, "GET")
      .mockResolvedValue({ data: { question: null, exhausted: "ALL" }, response: new Response() });
    const q = quizNextQuery("category-1");
    expect(q.queryKey).not.toEqual(quizNextQuery("category-2").queryKey);
    await q.queryFn?.({} as never);
    expect(get).toHaveBeenCalledWith("/api/quiz/categories/{categoryId}/next", {
      params: { path: { categoryId: "category-1" } },
    });
  });
});
