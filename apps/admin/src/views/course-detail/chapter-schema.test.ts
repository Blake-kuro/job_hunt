import { describe, expect, it } from "vitest";
import { defaultValues, schema, toBody } from "./chapter-schema";

describe("chapter-schema", () => {
  it("章名称必填并 trim", () => {
    expect(schema.safeParse(defaultValues).success).toBe(false);
    expect(toBody({ title: " 第一章 " })).toEqual({ title: "第一章" });
  });
});
