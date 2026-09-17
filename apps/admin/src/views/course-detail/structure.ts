import type { AdminLessonOrderBody } from "@job-hunt/api-client/types";

/** 课程结构的最小形状：章（含课时）+ 未分章课时；AdminCourseDetail 满足该形状 */
export interface Structure<
  L extends { id: string } = { id: string },
  C extends { id: string; lessons: L[] } = { id: string; lessons: L[] },
> {
  chapters: C[];
  unchaptered: L[];
}

export type Direction = "up" | "down";

/** 数组内把下标 i 的元素向上 / 下挪一位；越界返回 null（不可移动） */
function swap<T>(list: T[], i: number, dir: Direction): T[] | null {
  const j = dir === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= list.length) return null;
  const next = list.slice();
  [next[i], next[j]] = [next[j] as T, next[i] as T];
  return next;
}

/**
 * 课时在所在分组（某章或未分章）内上移 / 下移一位；不跨组。
 * 已在边缘或找不到课时时返回 null，调用方据此禁用按钮 / 跳过请求。
 */
export function moveLesson<L extends { id: string }, C extends { id: string; lessons: L[] }>(
  s: Structure<L, C>,
  lessonId: string,
  dir: Direction,
): Structure<L, C> | null {
  const ui = s.unchaptered.findIndex((l) => l.id === lessonId);
  if (ui >= 0) {
    const unchaptered = swap(s.unchaptered, ui, dir);
    return unchaptered && { chapters: s.chapters, unchaptered };
  }
  for (let ci = 0; ci < s.chapters.length; ci++) {
    const chapter = s.chapters[ci] as C;
    const li = chapter.lessons.findIndex((l) => l.id === lessonId);
    if (li < 0) continue;
    const lessons = swap(chapter.lessons, li, dir);
    if (!lessons) return null;
    const chapters = s.chapters.slice();
    chapters[ci] = { ...chapter, lessons };
    return { chapters, unchaptered: s.unchaptered };
  }
  return null;
}

/** 章上移 / 下移一位（连同其课时）；已在边缘或找不到时返回 null */
export function moveChapter<L extends { id: string }, C extends { id: string; lessons: L[] }>(
  s: Structure<L, C>,
  chapterId: string,
  dir: Direction,
): Structure<L, C> | null {
  const ci = s.chapters.findIndex((c) => c.id === chapterId);
  if (ci < 0) return null;
  const chapters = swap(s.chapters, ci, dir);
  return chapters && { chapters, unchaptered: s.unchaptered };
}

/**
 * 把课时挪到另一组（某章或 null = 未分章）的末尾；目标组不存在、课时不存在或已在该组时返回 null。
 * 配合 PATCH chapterId 使用：后端换章只改 chapterId 不改序号，这里再提交一次整体顺序让它排到末尾。
 */
export function moveLessonToGroup<L extends { id: string }, C extends { id: string; lessons: L[] }>(
  s: Structure<L, C>,
  lessonId: string,
  targetChapterId: string | null,
): Structure<L, C> | null {
  if (targetChapterId !== null && !s.chapters.some((c) => c.id === targetChapterId)) return null;
  let lesson: L | undefined;
  const currentGroup = s.unchaptered.some((l) => l.id === lessonId)
    ? null
    : (s.chapters.find((c) => c.lessons.some((l) => l.id === lessonId))?.id ?? undefined);
  if (currentGroup === undefined || currentGroup === targetChapterId) return null;
  const without = (list: L[]) =>
    list.filter((l) => {
      if (l.id !== lessonId) return true;
      lesson = l;
      return false;
    });
  const chapters = s.chapters.map((c) => (c.id === currentGroup ? { ...c, lessons: without(c.lessons) } : c));
  const unchaptered = currentGroup === null ? without(s.unchaptered) : s.unchaptered;
  if (!lesson) return null;
  const moved = lesson;
  if (targetChapterId === null) return { chapters, unchaptered: [...unchaptered, moved] };
  return {
    chapters: chapters.map((c) => (c.id === targetChapterId ? { ...c, lessons: [...c.lessons, moved] } : c)),
    unchaptered,
  };
}

/** 整棵结构 → 排序接口 body（覆盖全部章与全部课时，顺序即数组顺序） */
export function toOrderBody(s: Structure): AdminLessonOrderBody {
  return {
    chapters: s.chapters.map((c) => ({ id: c.id, lessonIds: c.lessons.map((l) => l.id) })),
    unchaptered: s.unchaptered.map((l) => l.id),
  };
}
