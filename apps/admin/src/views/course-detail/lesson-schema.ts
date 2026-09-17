import type { AdminLesson, AdminLessonBody } from "@job-hunt/api-client/types";
import { z } from "zod";

/** Radix Select 的项不能是空串：「未分章」用这个哨兵值 */
export const NO_CHAPTER = "none";

export const schema = z.object({
  title: z.string().trim().min(1, "请填写课时标题").max(200, "课时标题最多 200 字"),
  /** 章 id 或 NO_CHAPTER */
  chapterId: z.string(),
  freePreview: z.boolean(),
});

export type FormValues = z.infer<typeof schema>;

export const defaultValues: FormValues = { title: "", chapterId: NO_CHAPTER, freePreview: false };

export function fromEntity(l: AdminLesson): FormValues {
  return { title: l.title, chapterId: l.chapterId ?? NO_CHAPTER, freePreview: l.freePreview };
}

/** 新建与编辑共用同一组字段：chapterId 哨兵 → null（未分章） */
export function toBody(v: FormValues): AdminLessonBody {
  return {
    title: v.title.trim(),
    chapterId: v.chapterId === NO_CHAPTER ? null : v.chapterId,
    freePreview: v.freePreview,
  };
}
