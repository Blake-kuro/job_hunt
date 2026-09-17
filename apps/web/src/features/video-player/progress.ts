import type { CourseDetail, CourseLesson, LessonProgressBody } from "@entities/course";

/** 播放到 ≥ 90% 视为看完；不知道时长（null / 0）时只有 `ended` 才算 */
export function shouldMarkCompleted(position: number, duration: number | null, ended = false): boolean {
  if (ended) return true;
  if (duration === null || !Number.isFinite(duration) || duration <= 0) return false;
  return position / duration >= 0.9;
}

/** 章内课时按章顺序展开，未分章的排最后（与课程页展示顺序一致） */
export function flattenLessons(detail: Pick<CourseDetail, "chapters" | "unchaptered">): CourseLesson[] {
  return [...detail.chapters.flatMap((c) => c.lessons), ...detail.unchaptered];
}

/** 当前课时之后第一个可播课时；没有则 null。currentId 不在列表里时从头找。 */
export function nextPlayableLesson(
  detail: Pick<CourseDetail, "chapters" | "unchaptered">,
  currentId: string,
): CourseLesson | null {
  const lessons = flattenLessons(detail);
  const index = lessons.findIndex((l) => l.id === currentId);
  return lessons.slice(index + 1).find((l) => l.playable) ?? null;
}

/** 「继续学习」目标：上次学到的课时 → 第一个可播课时 → null */
export function continueLessonId(
  detail: Pick<CourseDetail, "chapters" | "unchaptered" | "lastLessonId">,
): string | null {
  const lessons = flattenLessons(detail);
  if (detail.lastLessonId && lessons.some((l) => l.id === detail.lastLessonId && l.playable))
    return detail.lastLessonId;
  return lessons.find((l) => l.playable)?.id ?? null;
}

export function progressUrl(courseId: string, lessonId: string): string {
  return `/api/courses/${encodeURIComponent(courseId)}/lessons/${encodeURIComponent(lessonId)}/progress`;
}

/**
 * 离开页面 / 关闭标签时的最后一次上报：PUT 不能走 sendBeacon，用 keepalive fetch。
 * 失败静默；返回的 promise 只用于把「失效缓存」排在它之后。
 */
export function sendProgressKeepalive(courseId: string, lessonId: string, body: LessonProgressBody): Promise<void> {
  if (typeof fetch !== "function") return Promise.resolve();
  return fetch(progressUrl(courseId, lessonId), {
    method: "PUT",
    keepalive: true,
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
    .then(() => undefined)
    .catch(() => undefined);
}
