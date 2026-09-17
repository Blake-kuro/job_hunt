import type { AdminCourseDetail } from "@job-hunt/api-client/types";
import { describe, expect, it } from "vitest";
import { centsToYuan, defaultValues, type FormValues, fromEntity, schema, toBody, yuanToCents } from "./course-schema";

function messages(values: FormValues): string[] {
  const r = schema.safeParse(values);
  return r.success ? [] : r.error.issues.map((i) => i.message);
}

const valid: FormValues = { ...defaultValues, title: "面试通关", price: "199.9" };

describe("course-schema", () => {
  it("标题必填；价格为非负两位小数；封面须 http(s)；排序为整数", () => {
    expect(messages({ ...valid, title: " " })).toEqual(["请填写标题"]);
    expect(messages({ ...valid, price: "-1" })).toEqual(["价格为非负数字（元），最多两位小数"]);
    expect(messages({ ...valid, price: "1.999" })).toEqual(["价格为非负数字（元），最多两位小数"]);
    expect(messages({ ...valid, price: "" })).toEqual(["价格为非负数字（元），最多两位小数"]);
    expect(messages({ ...valid, coverUrl: "ftp://x" })).toEqual(["封面链接需以 http:// 或 https:// 开头"]);
    expect(messages({ ...valid, sortOrder: "1.5" })).toEqual(["排序为整数"]);
    expect(messages(valid)).toEqual([]);
    expect(messages({ ...valid, price: "0", coverUrl: "", sortOrder: "-2" })).toEqual([]);
  });

  it("元 ↔ 分换算无浮点误差", () => {
    expect(yuanToCents("199.9")).toBe(19990);
    expect(yuanToCents("0.29")).toBe(29);
    expect(yuanToCents("1.15")).toBe(115);
    expect(centsToYuan(19990)).toBe("199.9");
    expect(centsToYuan(20000)).toBe("200");
    expect(centsToYuan(5)).toBe("0.05");
    expect(centsToYuan(0)).toBe("0");
  });

  it("toBody：可选文本空 → null，价格转分，排序留空不发", () => {
    expect(toBody({ ...valid, summary: " ", teacher: " 王老师 ", price: "12.5" })).toEqual({
      title: "面试通关",
      summary: null,
      description: null,
      teacher: "王老师",
      priceCents: 1250,
      coverUrl: null,
      published: false,
    });
    expect(toBody({ ...valid, sortOrder: "3", coverUrl: "https://x/y.png", published: true })).toMatchObject({
      sortOrder: 3,
      coverUrl: "https://x/y.png",
      published: true,
    });
  });

  it("fromEntity：null → 空串，分 → 元，列表项无 description 时为空串", () => {
    const detail: AdminCourseDetail = {
      id: "c1",
      title: "T",
      summary: null,
      description: "详",
      coverUrl: null,
      teacher: "师",
      priceCents: 9900,
      published: true,
      sortOrder: 2,
      lessonCount: 0,
      readyCount: 0,
      grantCount: 0,
      createdAt: "",
      updatedAt: "",
      chapters: [],
      unchaptered: [],
    };
    expect(fromEntity(detail)).toEqual({
      title: "T",
      summary: "",
      description: "详",
      teacher: "师",
      price: "99",
      coverUrl: "",
      sortOrder: "2",
      published: true,
    });
    const { description: _d, chapters: _c, unchaptered: _u, ...listItem } = detail;
    expect(fromEntity(listItem).description).toBe("");
  });
});
