import type { AdminJob, AdminJobBody, CategoryId } from "@api/types";

export const CATEGORY_LABEL: Record<CategoryId, string> = { 1: "秋招与实习", 2: "央国企", 3: "外企" };

export type JobFormState = {
  categoryId: "1" | "2" | "3";
  enterpriseName: string;
  position: string;
  serialNumber: string;
  recruitmentBatch: string;
  enterpriseNature: string;
  industry: string;
  workLocation: string;
  graduationYear: string;
  degree: string;
  announcementLink: string;
  deliveryAddress: string;
  deadline: string;
  deadlineAt: string;
};

export const emptyJobForm: JobFormState = {
  categoryId: "1",
  enterpriseName: "",
  position: "",
  serialNumber: "",
  recruitmentBatch: "",
  enterpriseNature: "",
  industry: "",
  workLocation: "",
  graduationYear: "",
  degree: "",
  announcementLink: "",
  deliveryAddress: "",
  deadline: "",
  deadlineAt: "",
};

const OPTIONAL_KEYS = [
  "serialNumber",
  "recruitmentBatch",
  "enterpriseNature",
  "industry",
  "workLocation",
  "graduationYear",
  "degree",
  "announcementLink",
  "deliveryAddress",
  "deadline",
  "deadlineAt",
] as const;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** 后端 null → 表单空串 */
export function fromJob(j: AdminJob): JobFormState {
  const state: JobFormState = {
    ...emptyJobForm,
    categoryId: String(j.categoryId) as JobFormState["categoryId"],
    enterpriseName: j.enterpriseName,
    position: j.position,
  };
  for (const key of OPTIONAL_KEYS) state[key] = j[key] ?? "";
  return state;
}

/** 校验并转成请求体：必填 trim 后非空；可选空串 → null（清空）、非空 → trim */
export function toJobBody(s: JobFormState): { ok: true; body: AdminJobBody } | { ok: false; error: string } {
  const enterpriseName = s.enterpriseName.trim();
  if (!enterpriseName) return { ok: false, error: "请填写企业名称" };
  const position = s.position.trim();
  if (!position) return { ok: false, error: "请填写岗位名称" };
  const deadlineAt = s.deadlineAt.trim();
  if (deadlineAt && !DATE_RE.test(deadlineAt)) return { ok: false, error: "截止日期格式为 YYYY-MM-DD" };

  const body: AdminJobBody = { categoryId: Number(s.categoryId) as CategoryId, enterpriseName, position };
  for (const key of OPTIONAL_KEYS) {
    const value = s[key].trim();
    body[key] = value || null;
  }
  return { ok: true, body };
}
