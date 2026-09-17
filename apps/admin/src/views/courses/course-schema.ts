import type { AdminCourse, AdminCourseBody, AdminCourseDetail } from "@job-hunt/api-client/types";
import { z } from "zod";

const PRICE_RE = /^\d+(\.\d{1,2})?$/;
const INT_RE = /^-?\d+$/;
const HTTP_RE = /^https?:\/\//;

/** 课程基本信息：价格以「元」录入（字符串，最多两位小数），提交时换算为分 */
export const schema = z.object({
  title: z.string().trim().min(1, "请填写标题").max(200, "标题最多 200 字"),
  summary: z.string().trim().max(500, "简介最多 500 字"),
  description: z.string().trim().max(5000, "详细介绍最多 5000 字"),
  teacher: z.string().trim().max(100, "讲师最多 100 字"),
  price: z
    .string()
    .trim()
    .refine((v) => PRICE_RE.test(v), "价格为非负数字（元），最多两位小数"),
  coverUrl: z
    .string()
    .trim()
    .refine((v) => v === "" || HTTP_RE.test(v), "封面链接需以 http:// 或 https:// 开头"),
  sortOrder: z
    .string()
    .trim()
    .refine((v) => v === "" || INT_RE.test(v), "排序为整数"),
  published: z.boolean(),
});

export type FormValues = z.infer<typeof schema>;

export const defaultValues: FormValues = {
  title: "",
  summary: "",
  description: "",
  teacher: "",
  price: "0",
  coverUrl: "",
  sortOrder: "",
  published: false,
};

/** 分 → 元字符串，去掉末尾的 0 与小数点（19990 → "199.9"，20000 → "200"） */
export function centsToYuan(cents: number): string {
  return (cents / 100).toFixed(2).replace(/\.?0+$/, "");
}

/** 元字符串（已通过 schema）→ 分；用 round 避免 0.1 + 0.2 类浮点误差 */
export function yuanToCents(yuan: string): number {
  return Math.round(Number(yuan) * 100);
}

/** 列表项没有 description，详情才有 */
export function fromEntity(c: AdminCourse | AdminCourseDetail): FormValues {
  return {
    title: c.title,
    summary: c.summary ?? "",
    description: "description" in c ? (c.description ?? "") : "",
    teacher: c.teacher ?? "",
    price: centsToYuan(c.priceCents),
    coverUrl: c.coverUrl ?? "",
    sortOrder: String(c.sortOrder),
    published: c.published,
  };
}

/** 可选文本空 → null（清空）；排序留空不发（新建取默认 0，编辑不改） */
export function toBody(v: FormValues): AdminCourseBody {
  const body: AdminCourseBody = {
    title: v.title.trim(),
    summary: v.summary.trim() || null,
    description: v.description.trim() || null,
    teacher: v.teacher.trim() || null,
    priceCents: yuanToCents(v.price),
    coverUrl: v.coverUrl.trim() || null,
    published: v.published,
  };
  const sortOrder = v.sortOrder.trim();
  if (sortOrder !== "") body.sortOrder = Number(sortOrder);
  return body;
}
