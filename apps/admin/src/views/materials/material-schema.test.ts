import type { AdminMaterial } from "@job-hunt/api-client/types";
import { describe, expect, it } from "vitest";
import { defaultValues, type FormValues, fromEntity, schema, toBody } from "./material-schema";

function messages(values: FormValues): string[] {
  const r = schema.safeParse(values);
  return r.success ? [] : r.error.issues.map((i) => i.message);
}

const valid: FormValues = { ...defaultValues, title: "简历模板", url: "https://example.com/a.pdf" };

describe("material-schema", () => {
  it("标题必填；链接需以 http:// 或 https:// 开头", () => {
    expect(messages({ ...valid, title: "  " })).toEqual(["请填写标题"]);
    expect(messages({ ...valid, url: "ftp://x" })).toEqual(["链接需以 http:// 或 https:// 开头"]);
    expect(messages({ ...valid, url: "" })).toEqual(["链接需以 http:// 或 https:// 开头"]);
    expect(messages(valid)).toEqual([]);
    expect(messages({ ...valid, url: "http://example.com" })).toEqual([]);
  });

  it("toBody：描述空 → null，分类空 → 未分类，文本 trim，带 id 即更新", () => {
    expect(
      toBody({ ...valid, title: " 简历模板 ", description: " ", category: "  ", url: " https://example.com " }),
    ).toEqual({
      id: undefined,
      title: "简历模板",
      description: null,
      category: "未分类",
      url: "https://example.com",
      published: false,
    });
    expect(toBody({ ...valid, description: "说明", category: "简历", published: true }, "m1")).toMatchObject({
      id: "m1",
      description: "说明",
      category: "简历",
      published: true,
    });
  });

  it("fromEntity 把 null 描述变成空串，resourceUrl 映射到 url", () => {
    const m: AdminMaterial = {
      id: "m1",
      title: "简历模板",
      description: null,
      category: "简历",
      resourceUrl: "https://example.com/a.pdf",
      published: true,
      updatedAt: "2026-09-01T00:00:00.000Z",
    };
    expect(fromEntity(m)).toEqual({
      title: "简历模板",
      description: "",
      category: "简历",
      url: "https://example.com/a.pdf",
      published: true,
    });
  });
});
