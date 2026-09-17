import { describe, expect, it } from "vitest";
import { fromEntity, schema, toBody } from "./category-schema";

describe("category-schema", () => {
  it("名称 trim 后必填，文案「请填写名称」", () => {
    const r = schema.safeParse({ name: "  " });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toBe("请填写名称");
    expect(schema.safeParse({ name: "中国华电" }).success).toBe(true);
  });

  it("toBody trim 名称；fromEntity 原样取名", () => {
    expect(toBody({ name: " 公共与行业知识 " })).toEqual({ name: "公共与行业知识" });
    expect(fromEntity({ name: "中国华电" })).toEqual({ name: "中国华电" });
  });
});
