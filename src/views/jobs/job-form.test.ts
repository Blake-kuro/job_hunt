import { describe, expect, it } from "vitest";
import type { AdminJob } from "@api/types";
import { emptyJobForm, fromJob, toJobBody } from "./job-form";

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

describe("job-form", () => {
  it("企业名称 / 岗位名称 trim 后为空时报错", () => {
    expect(toJobBody({ ...emptyJobForm, enterpriseName: "  ", position: "前端" })).toEqual({
      ok: false,
      error: "请填写企业名称",
    });
    expect(toJobBody({ ...emptyJobForm, enterpriseName: "示例公司", position: "  " })).toEqual({
      ok: false,
      error: "请填写岗位名称",
    });
  });

  it("截止日期非空时必须是 YYYY-MM-DD", () => {
    const base = { ...emptyJobForm, enterpriseName: "示例公司", position: "前端" };
    expect(toJobBody({ ...base, deadlineAt: "2026/09/30" })).toEqual({
      ok: false,
      error: "截止日期格式为 YYYY-MM-DD",
    });
    expect(toJobBody({ ...base, deadlineAt: "2026-09-30" })).toMatchObject({
      ok: true,
      body: { deadlineAt: "2026-09-30" },
    });
  });

  it("可选字段空串 → null，非空 → trim；分类转成数字", () => {
    const result = toJobBody({
      ...emptyJobForm,
      categoryId: "3",
      enterpriseName: " 示例公司 ",
      position: " 前端 ",
      industry: " 互联网 ",
    });
    expect(result).toEqual({
      ok: true,
      body: {
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
      },
    });
  });

  it("fromJob 把 null 变成空串，再经 toJobBody 往返得到原字段", () => {
    const state = fromJob(job);
    expect(state.categoryId).toBe("2");
    expect(state.enterpriseNature).toBe("");
    expect(state.deadlineAt).toBe("2026-09-30");
    expect(toJobBody(state)).toEqual({
      ok: true,
      body: {
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
      },
    });
  });
});
