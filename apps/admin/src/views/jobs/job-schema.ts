import type { AdminJob, AdminJobBody, CategoryId } from "@job-hunt/api-client/types";
import { z } from "zod";

export const CATEGORY_LABEL: Record<CategoryId, string> = { 1: "秋招与实习", 2: "央国企", 3: "外企" };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** 岗位表单：必填 trim 后非空；截止日期允许空串或 YYYY-MM-DD */
export const schema = z.object({
  categoryId: z.enum(["1", "2", "3"]),
  enterpriseName: z.string().trim().min(1, "请填写企业名称"),
  position: z.string().trim().min(1, "请填写岗位名称"),
  serialNumber: z.string(),
  recruitmentBatch: z.string(),
  enterpriseNature: z.string(),
  industry: z.string(),
  workLocation: z.string(),
  graduationYear: z.string(),
  degree: z.string(),
  announcementLink: z.string(),
  deliveryAddress: z.string(),
  deadline: z.string(),
  // 先 trim 再判空：空白串视为未填（toBody 发 null），非空才校验格式
  deadlineAt: z
    .string()
    .trim()
    .refine((v) => v === "" || DATE_RE.test(v), "截止日期格式为 YYYY-MM-DD"),
});

export type FormValues = z.infer<typeof schema>;

export const defaultValues: FormValues = {
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

export const OPTIONAL_KEYS = [
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

/** 后端 null → 表单空串 */
export function fromEntity(j: AdminJob): FormValues {
  const values: FormValues = {
    ...defaultValues,
    categoryId: String(j.categoryId) as FormValues["categoryId"],
    enterpriseName: j.enterpriseName,
    position: j.position,
  };
  for (const key of OPTIONAL_KEYS) values[key] = j[key] ?? "";
  return values;
}

/** 校验通过的表单值 → 请求体：可选字段空串 → null（清空）、非空 → trim；分类转数字 */
export function toBody(v: FormValues): AdminJobBody {
  const body: AdminJobBody = {
    categoryId: Number(v.categoryId) as CategoryId,
    enterpriseName: v.enterpriseName.trim(),
    position: v.position.trim(),
  };
  for (const key of OPTIONAL_KEYS) {
    const value = v[key].trim();
    body[key] = value || null;
  }
  return body;
}
