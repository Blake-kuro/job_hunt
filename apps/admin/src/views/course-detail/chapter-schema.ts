import type { AdminChapterBody } from "@job-hunt/api-client/types";
import { z } from "zod";

export const schema = z.object({
  title: z.string().trim().min(1, "请填写章名称").max(200, "章名称最多 200 字"),
});

export type FormValues = z.infer<typeof schema>;

export const defaultValues: FormValues = { title: "" };

export function fromEntity(c: { title: string }): FormValues {
  return { title: c.title };
}

export function toBody(v: FormValues): AdminChapterBody {
  return { title: v.title.trim() };
}
