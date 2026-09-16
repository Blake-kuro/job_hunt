import type { AdminCourseBody, AdminCourseLesson } from "@api/types";

/** 课时编辑器里的一行；durationMinutes 是 <input type="number"> 的字符串值，"" 表示未填 */
export interface LessonRow {
  title: string;
  videoUrl: string;
  durationMinutes: string;
}

export type CourseLessonBody = AdminCourseBody["lessons"][number];

export const emptyLessonRow: LessonRow = { title: "", videoUrl: "", durationMinutes: "" };

export const HTTP_RE = /^https?:\/\//;

/** 后端课时 → 行编辑器初值（按后端返回顺序，即 sortOrder） */
export function fromLessons(lessons: AdminCourseLesson[]): LessonRow[] {
  return lessons.map((l) => ({
    title: l.title,
    videoUrl: l.videoUrl,
    durationMinutes: l.durationMinutes === null ? "" : String(l.durationMinutes),
  }));
}

/** 上移 / 下移一行：返回新数组；已在首 / 尾时原样返回 */
export function moveLesson(rows: LessonRow[], index: number, dir: "up" | "down"): LessonRow[] {
  const target = dir === "up" ? index - 1 : index + 1;
  if (index < 0 || index >= rows.length || target < 0 || target >= rows.length) return rows;
  const next = [...rows];
  next[index] = rows[target];
  next[target] = rows[index];
  return next;
}

/** 行编辑器 → 请求体 lessons：每行标题 / 视频链接必填且 URL 以 http 开头；时长空串 → null */
export function toCourseLessons(
  rows: LessonRow[],
): { ok: true; lessons: CourseLessonBody[] } | { ok: false; error: string } {
  const lessons: CourseLessonBody[] = [];
  for (const [i, row] of rows.entries()) {
    const title = row.title.trim();
    const videoUrl = row.videoUrl.trim();
    if (!title || !videoUrl) return { ok: false, error: `第 ${i + 1} 课时缺少标题或视频链接` };
    if (!HTTP_RE.test(videoUrl)) return { ok: false, error: `第 ${i + 1} 课时视频链接需以 http:// 或 https:// 开头` };
    const duration = row.durationMinutes.trim();
    lessons.push({ title, videoUrl, durationMinutes: duration ? Number(duration) : null });
  }
  return { ok: true, lessons };
}
