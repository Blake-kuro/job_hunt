import { describe, expect, it } from "vitest";
import { NO_CHAPTER, defaultValues, fromEntity, schema, toBody } from "./lesson-schema";

describe("lesson-schema", () => {
  it("标题必填", () => {
    const r = schema.safeParse({ ...defaultValues, title: "  " });
    expect(r.success).toBe(false);
    expect(r.error?.issues.map((i) => i.message)).toEqual(["请填写课时标题"]);
  });

  it("toBody：哨兵 → null，章 id 原样；fromEntity 反向", () => {
    expect(toBody({ title: " 第一课 ", chapterId: NO_CHAPTER, freePreview: true })).toEqual({
      title: "第一课",
      chapterId: null,
      freePreview: true,
    });
    expect(toBody({ title: "x", chapterId: "ch1", freePreview: false }).chapterId).toBe("ch1");
    expect(
      fromEntity({
        id: "l",
        chapterId: null,
        title: "t",
        sortOrder: 0,
        freePreview: false,
        videoFileId: null,
        videoStatus: "NONE",
        durationSeconds: null,
      }),
    ).toEqual({ title: "t", chapterId: NO_CHAPTER, freePreview: false });
  });
});
