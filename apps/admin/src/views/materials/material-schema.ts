import type { AdminMaterial, AdminMaterialBody } from "@job-hunt/api-client/types";
import { z } from "zod";

export const DEFAULT_CATEGORY = "未分类";
const HTTP_RE = /^https?:\/\//;

/** 资料表单：标题必填；链接需 http(s) 开头 */
export const schema = z.object({
  title: z.string().trim().min(1, "请填写标题"),
  description: z.string(),
  category: z.string(),
  url: z.string().trim().regex(HTTP_RE, "链接需以 http:// 或 https:// 开头"),
  published: z.boolean(),
});

export type FormValues = z.infer<typeof schema>;

export const defaultValues: FormValues = {
  title: "",
  description: "",
  category: DEFAULT_CATEGORY,
  url: "",
  published: false,
};

export function fromEntity(m: AdminMaterial): FormValues {
  return {
    title: m.title,
    description: m.description ?? "",
    category: m.category,
    url: m.resourceUrl,
    published: m.published,
  };
}

/** 校验通过的表单值 → 请求体：描述空 → null，分类空 → 「未分类」；带 id 即更新 */
export function toBody(v: FormValues, id?: string): AdminMaterialBody {
  const description = v.description.trim();
  return {
    id,
    title: v.title.trim(),
    description: description || null,
    category: v.category.trim() || DEFAULT_CATEGORY,
    url: v.url.trim(),
    published: v.published,
  };
}
