import { z } from "zod";

/** 公司 / 分类共用的单名称表单 */
export const schema = z.object({
  name: z.string().trim().min(1, "请填写名称").max(50),
});

export type FormValues = z.infer<typeof schema>;

export const defaultValues: FormValues = { name: "" };

export function fromEntity(entity: { name: string }): FormValues {
  return { name: entity.name };
}

export function toBody(v: FormValues): { name: string } {
  return { name: v.name.trim() };
}
