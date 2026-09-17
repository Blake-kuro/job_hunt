import type { AdminContentBody, AdminCourse, AdminCourseLesson } from "@job-hunt/api-client/types";
import { z } from "zod";

export const HTTP_RE = /^https?:\/\//;

/** 课时编辑器里的一行；durationMinutes 是 <input type="number"> 的字符串值，"" 表示未填 */
const lesson = z.object({
  title: z.string(),
  videoUrl: z.string(),
  durationMinutes: z.string(),
});

/**
 * 课程表单：标题必填、封面链接可空但需 http(s) 开头；
 * 课时逐行校验（标题 / 视频链接必填、视频链接需 http(s) 开头），错误挂在该行对应字段上。
 */
export const schema = z
  .object({
    title: z.string().trim().min(1, "请填写标题"),
    description: z.string(),
    // 先 trim 再判空：空白串视为未填（toBody 发 null），非空才校验前缀
    coverUrl: z
      .string()
      .trim()
      .refine((v) => v === "" || HTTP_RE.test(v), "封面链接需以 http:// 或 https:// 开头"),
    published: z.boolean(),
    lessons: z.array(lesson),
  })
  .superRefine((v, ctx) => {
    v.lessons.forEach((row, i) => {
      const title = row.title.trim();
      const videoUrl = row.videoUrl.trim();
      if (!title || !videoUrl) {
        ctx.addIssue({
          code: "custom",
          path: ["lessons", i, title ? "videoUrl" : "title"],
          message: `第 ${i + 1} 课时缺少标题或视频链接`,
        });
      } else if (!HTTP_RE.test(videoUrl)) {
        ctx.addIssue({
          code: "custom",
          path: ["lessons", i, "videoUrl"],
          message: `第 ${i + 1} 课时视频链接需以 http:// 或 https:// 开头`,
        });
      }
    });
  });

export type FormValues = z.infer<typeof schema>;
export type LessonRow = FormValues["lessons"][number];
export type CourseLessonBody = Extract<AdminContentBody, { type: "COURSE" }>["lessons"][number];

export const emptyLessonRow: LessonRow = { title: "", videoUrl: "", durationMinutes: "" };

export const defaultValues: FormValues = { title: "", description: "", coverUrl: "", published: false, lessons: [] };

/** 后端课时 → 行编辑器初值（按后端返回顺序，即 sortOrder） */
export function fromLessons(lessons: AdminCourseLesson[]): LessonRow[] {
  return lessons.map((l) => ({
    title: l.title,
    videoUrl: l.videoUrl,
    durationMinutes: l.durationMinutes === null ? "" : String(l.durationMinutes),
  }));
}

export function fromEntity(c: AdminCourse): FormValues {
  return {
    title: c.title,
    description: c.description ?? "",
    coverUrl: c.coverUrl ?? "",
    published: c.published,
    lessons: fromLessons(c.lessons),
  };
}

/** 校验通过的课时行 → 请求体 lessons：文本 trim，时长空串 → null */
export function toLessons(rows: LessonRow[]): CourseLessonBody[] {
  return rows.map((row) => {
    const duration = row.durationMinutes.trim();
    return {
      title: row.title.trim(),
      videoUrl: row.videoUrl.trim(),
      durationMinutes: duration ? Number(duration) : null,
    };
  });
}

/** 校验通过的表单值 → 请求体：描述 / 封面空 → null；带 id 即更新；课时顺序即 sortOrder */
export function toBody(v: FormValues, id?: string): AdminContentBody {
  const description = v.description.trim();
  const coverUrl = v.coverUrl.trim();
  return {
    type: "COURSE",
    id,
    title: v.title.trim(),
    description: description || null,
    coverUrl: coverUrl || null,
    published: v.published,
    lessons: toLessons(v.lessons),
  };
}
