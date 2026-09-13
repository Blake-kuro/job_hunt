import { describe, expect, it } from "vitest";
import { jobListQuerySchema } from "./job";

describe("jobListQuerySchema", () => {
  it("空对象得到默认值", () => {
    expect(jobListQuerySchema.parse({})).toEqual({ sort: "deadline", page: 1, pageSize: 20 });
  });
  it("字符串数字被 coerce", () => {
    expect(jobListQuerySchema.parse({ category: "2", page: "3" })).toMatchObject({ category: 2, page: 3 });
  });
  it("非法 category 报错", () => {
    expect(jobListQuerySchema.safeParse({ category: "9" }).success).toBe(false);
  });
  it("空白 q 视为非法（调用方应省略）", () => {
    expect(jobListQuerySchema.safeParse({ q: "  " }).success).toBe(false);
  });
});
