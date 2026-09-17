import type { AdminJob } from "@job-hunt/api-client/types";
import { describe, expect, it } from "vitest";
import { defaultValues, type FormValues, fromEntity, schema, toBody } from "./job-schema";

const job: AdminJob = {
  id: 7,
  serialNumber: "A-001",
  categoryId: 2,
  recruitmentBatch: "2026 秋招",
  enterpriseNature: null,
  industry: "互联网",
  workLocation: "上海",
  position: "前端开发",
  enterpriseName: "示例公司",
  graduationYear: "2026",
  degree: null,
  announcementLink: "https://example.com/job",
  deliveryAddress: null,
  deadline: "9 月底",
  deadlineAt: "2026-09-30",
  createTime: "2026-09-01T00:00:00.000Z",
  updateTime: "2026-09-01T00:00:00.000Z",
  stats: { favorites: 1, applications: 2 },
};

/** 校验失败时返回 [字段路径, 文案]，成功时返回 null */
function firstIssue(values: FormValues): [string, string] | null {
  const r = schema.safeParse(values);
  if (r.success) return null;
  const issue = r.error.issues[0];
  return [issue.path.join("."), issue.message];
}

describe("job-schema", () => {
  it("企业名称 / 岗位名称 trim 后为空时报错", () => {
    expect(firstIssue({ ...defaultValues, enterpriseName: "  ", position: "前端" })).toEqual([
      "enterpriseName",
      "请填写企业名称",
    ]);
    expect(firstIssue({ ...defaultValues, enterpriseName: "示例公司", position: "  " })).toEqual([
      "position",
      "请填写岗位名称",
    ]);
  });

  it("截止日期非空时必须是 YYYY-MM-DD", () => {
    const base = { ...defaultValues, enterpriseName: "示例公司", position: "前端" };
    expect(firstIssue({ ...base, deadlineAt: "2026/09/30" })).toEqual(["deadlineAt", "截止日期格式为 YYYY-MM-DD"]);
    expect(firstIssue({ ...base, deadlineAt: "" })).toBeNull();
    expect(firstIssue({ ...base, deadlineAt: "2026-09-30" })).toBeNull();
    expect(toBody({ ...base, deadlineAt: "2026-09-30" })).toMatchObject({ deadlineAt: "2026-09-30" });
  });

  it("分类只接受 1 / 2 / 3", () => {
    const base = { ...defaultValues, enterpriseName: "示例公司", position: "前端" };
    expect(schema.safeParse({ ...base, categoryId: "4" }).success).toBe(false);
    expect(schema.safeParse({ ...base, categoryId: "3" }).success).toBe(true);
  });

  it("可选字段空串 → null，非空 → trim；分类转成数字", () => {
    expect(
      toBody({
        ...defaultValues,
        categoryId: "3",
        enterpriseName: " 示例公司 ",
        position: " 前端 ",
        industry: " 互联网 ",
      }),
    ).toEqual({
      categoryId: 3,
      enterpriseName: "示例公司",
      position: "前端",
      serialNumber: null,
      recruitmentBatch: null,
      enterpriseNature: null,
      industry: "互联网",
      workLocation: null,
      graduationYear: null,
      degree: null,
      announcementLink: null,
      deliveryAddress: null,
      deadline: null,
      deadlineAt: null,
    });
  });

  it("fromEntity 把 null 变成空串，再经 schema + toBody 往返得到原字段", () => {
    const values = fromEntity(job);
    expect(values.categoryId).toBe("2");
    expect(values.enterpriseNature).toBe("");
    expect(values.deadlineAt).toBe("2026-09-30");
    const parsed = schema.safeParse(values);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(toBody(parsed.data)).toEqual({
      categoryId: 2,
      enterpriseName: "示例公司",
      position: "前端开发",
      serialNumber: "A-001",
      recruitmentBatch: "2026 秋招",
      enterpriseNature: null,
      industry: "互联网",
      workLocation: "上海",
      graduationYear: "2026",
      degree: null,
      announcementLink: "https://example.com/job",
      deliveryAddress: null,
      deadline: "9 月底",
      deadlineAt: "2026-09-30",
    });
  });
});
