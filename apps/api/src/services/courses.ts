import type { CourseAccess, CourseCard, CourseDetail, CourseLesson, LessonProgressBody } from "../contract";
import { prisma } from "../db";
import type { Role } from "../lib/access";
import { AppError } from "../lib/errors";
import { orNotFound } from "../lib/route";
import { signPlay } from "../lib/vod";

type LessonRow = {
  id: string;
  title: string;
  chapterId: string | null;
  sortOrder: number;
  freePreview: boolean;
  videoFileId: string | null;
  videoStatus: CourseLesson["videoStatus"];
  durationSeconds: number | null;
};
type ProgressRow = { lessonId: string; positionSeconds: number; completed: boolean; updatedAt: Date };

const courseCardSelect = {
  id: true,
  title: true,
  summary: true,
  coverUrl: true,
  teacher: true,
  priceCents: true,
  lessons: { select: { id: true, freePreview: true, videoStatus: true, durationSeconds: true } },
} as const;
type CourseCardRow = {
  id: string;
  title: string;
  summary: string | null;
  coverUrl: string | null;
  teacher: string | null;
  priceCents: number;
  lessons: {
    id: string;
    freePreview: boolean;
    videoStatus: CourseLesson["videoStatus"];
    durationSeconds: number | null;
  }[];
};

const activeGrantWhere = (userId: string) => ({
  userId,
  contentType: "COURSE" as const,
  OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
});

/** 当前用户有效授权的课程 id 集合（管理员不查库，靠 role 放行） */
export async function grantedCourseIds(userId: string, role: Role): Promise<Set<string>> {
  if (role === "ADMIN") return new Set();
  const rows = await prisma.accessGrant.findMany({ where: activeGrantWhere(userId), select: { contentId: true } });
  return new Set(rows.map((g) => g.contentId));
}

/** 免费课 / 有授权 / 管理员 → GRANTED；有试看课时 → PREVIEW；否则 LOCKED */
export function courseAccess(
  course: { id: string; priceCents: number; lessons: { freePreview: boolean }[] },
  grants: Set<string>,
  role: Role,
): CourseAccess {
  if (role === "ADMIN" || course.priceCents === 0 || grants.has(course.id)) return "GRANTED";
  return course.lessons.some((l) => l.freePreview) ? "PREVIEW" : "LOCKED";
}

export const isPlayable = (lesson: { videoStatus: string; freePreview: boolean }, access: CourseAccess) =>
  lesson.videoStatus === "READY" && (access === "GRANTED" || lesson.freePreview);

/** 该用户能否观看该课时（不看视频是否就绪）；不能 → 403 */
export function assertCourseAccess(
  course: { id: string; priceCents: number; lessons: { freePreview: boolean }[] },
  lesson: { freePreview: boolean },
  grants: Set<string>,
  role: Role,
): CourseAccess {
  const access = courseAccess(course, grants, role);
  if (access !== "GRANTED" && !lesson.freePreview) throw new AppError(403, "FORBIDDEN", "该课时需要开通课程后观看");
  return access;
}

function progressPercent(lessonCount: number, completed: number, hasProgress: boolean): number | null {
  if (!hasProgress || lessonCount === 0) return null;
  return Math.round((completed / lessonCount) * 100);
}

function toCard(course: CourseCardRow, access: CourseAccess, progresses: ProgressRow[]): CourseCard {
  const lessonIds = new Set(course.lessons.map((l) => l.id));
  const mine = progresses.filter((p) => lessonIds.has(p.lessonId));
  return {
    id: course.id,
    title: course.title,
    summary: course.summary,
    coverUrl: course.coverUrl,
    teacher: course.teacher,
    priceCents: course.priceCents,
    lessonCount: course.lessons.length,
    durationSeconds: course.lessons.reduce((sum, l) => sum + (l.durationSeconds ?? 0), 0),
    freePreviewCount: course.lessons.filter((l) => l.freePreview).length,
    access,
    progressPercent: progressPercent(course.lessons.length, mine.filter((p) => p.completed).length, mine.length > 0),
  };
}

async function progressByCourse(userId: string, courseIds: string[]) {
  const rows = await prisma.lessonProgress.findMany({
    where: { userId, courseId: { in: courseIds } },
    select: { courseId: true, lessonId: true, positionSeconds: true, completed: true, updatedAt: true },
  });
  const map = new Map<string, ProgressRow[]>();
  for (const row of rows) {
    const list = map.get(row.courseId) ?? [];
    list.push(row);
    map.set(row.courseId, list);
  }
  return map;
}

export async function listCatalog(userId: string, role: Role): Promise<{ items: CourseCard[] }> {
  const [courses, grants] = await Promise.all([
    prisma.course.findMany({
      where: { published: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      select: courseCardSelect,
    }),
    grantedCourseIds(userId, role),
  ]);
  const progress = await progressByCourse(
    userId,
    courses.map((c) => c.id),
  );
  return {
    items: courses.map((c) => toCard(c, courseAccess(c, grants, role), progress.get(c.id) ?? [])),
  };
}

const lessonSelect = {
  id: true,
  title: true,
  chapterId: true,
  sortOrder: true,
  freePreview: true,
  videoFileId: true,
  videoStatus: true,
  durationSeconds: true,
} as const;

async function loadPublishedCourse(courseId: string) {
  return orNotFound(
    await prisma.course.findFirst({
      where: { id: courseId, published: true },
      select: {
        ...courseCardSelect,
        description: true,
        chapters: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }], select: { id: true, title: true } },
        lessons: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }], select: lessonSelect },
      },
    }),
    `课程 ${courseId} 不存在`,
  );
}

function toLesson(lesson: LessonRow, access: CourseAccess, progress: ProgressRow | undefined): CourseLesson {
  return {
    id: lesson.id,
    title: lesson.title,
    durationSeconds: lesson.durationSeconds,
    freePreview: lesson.freePreview,
    videoStatus: lesson.videoStatus,
    playable: isPlayable(lesson, access),
    progress: progress ? { positionSeconds: progress.positionSeconds, completed: progress.completed } : null,
  };
}

export async function getCourseDetail(userId: string, role: Role, courseId: string): Promise<CourseDetail> {
  const course = await loadPublishedCourse(courseId);
  const grants = await grantedCourseIds(userId, role);
  const access = courseAccess(course, grants, role);
  const progresses = (await progressByCourse(userId, [course.id])).get(course.id) ?? [];
  const byLesson = new Map(progresses.map((p) => [p.lessonId, p]));
  const lessonsOf = (chapterId: string | null) =>
    course.lessons.filter((l) => l.chapterId === chapterId).map((l) => toLesson(l, access, byLesson.get(l.id)));
  const latest = progresses.reduce<ProgressRow | null>(
    (best, p) => (best === null || p.updatedAt > best.updatedAt ? p : best),
    null,
  );
  return {
    ...toCard(course, access, progresses),
    description: course.description,
    chapters: course.chapters.map((ch) => ({ id: ch.id, title: ch.title, lessons: lessonsOf(ch.id) })),
    unchaptered: lessonsOf(null),
    lastLessonId: latest?.lessonId ?? null,
  };
}

/** 课程 + 课时 + 权限；课程未发布或课时不属于该课 → 404，无权 → 403 */
async function loadPlayableContext(userId: string, role: Role, courseId: string, lessonId: string) {
  const course = await loadPublishedCourse(courseId);
  const lesson = orNotFound(
    course.lessons.find((l) => l.id === lessonId),
    `课时 ${lessonId} 不存在`,
  );
  const grants = await grantedCourseIds(userId, role);
  const access = assertCourseAccess(course, lesson, grants, role);
  return { course, lesson, access };
}

export async function getPlayInfo(userId: string, role: Role, courseId: string, lessonId: string) {
  const { lesson } = await loadPlayableContext(userId, role, courseId, lessonId);
  if (lesson.videoStatus !== "READY" || !lesson.videoFileId) throw new AppError(409, "CONFLICT", "视频处理中");
  const progress = await prisma.lessonProgress.findUnique({
    where: { userId_lessonId: { userId, lessonId } },
    select: { positionSeconds: true },
  });
  return { ...signPlay(lesson.videoFileId), positionSeconds: progress?.positionSeconds ?? 0 };
}

/** 写进度：位置随播放更新；`completed` 只增不减 */
export async function saveProgress(
  userId: string,
  role: Role,
  courseId: string,
  lessonId: string,
  body: LessonProgressBody,
): Promise<void> {
  const { lesson } = await loadPlayableContext(userId, role, courseId, lessonId);
  if (lesson.videoStatus !== "READY") throw new AppError(403, "FORBIDDEN", "该课时视频尚未就绪");
  await prisma.lessonProgress.upsert({
    where: { userId_lessonId: { userId, lessonId } },
    create: { userId, lessonId, courseId, positionSeconds: body.positionSeconds, completed: body.completed ?? false },
    update: { positionSeconds: body.positionSeconds, ...(body.completed ? { completed: true } : {}) },
  });
}

/** 有授权或有进度的已发布课程，按最近学习（无进度则按授权时间）倒序 */
export async function listMyCourses(userId: string, role: Role) {
  const [grantRows, progressRows] = await Promise.all([
    prisma.accessGrant.findMany({ where: activeGrantWhere(userId), select: { contentId: true, createdAt: true } }),
    prisma.lessonProgress.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      select: { courseId: true, lessonId: true, positionSeconds: true, completed: true, updatedAt: true },
    }),
  ]);
  const grantedAt = new Map(grantRows.map((g) => [g.contentId, g.createdAt]));
  const grants = role === "ADMIN" ? new Set<string>() : new Set(grantedAt.keys());
  const courseIds = [...new Set([...grantedAt.keys(), ...progressRows.map((p) => p.courseId)])];
  if (courseIds.length === 0) return { items: [] };
  const courses = await prisma.course.findMany({
    where: { id: { in: courseIds }, published: true },
    select: { ...courseCardSelect, lessons: { select: { ...courseCardSelect.lessons.select, title: true } } },
  });
  const items = courses.map((course) => {
    const mine = progressRows.filter((p) => p.courseId === course.id);
    const latest = mine[0];
    const lastLesson = latest ? course.lessons.find((l) => l.id === latest.lessonId) : undefined;
    const updatedAt = latest?.updatedAt ?? grantedAt.get(course.id) ?? new Date(0);
    return {
      ...toCard(course, courseAccess(course, grants, role), mine),
      lastLessonId: lastLesson?.id ?? null,
      lastLessonTitle: lastLesson?.title ?? null,
      updatedAt,
    };
  });
  items.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime() || a.id.localeCompare(b.id));
  return { items: items.map((item) => ({ ...item, updatedAt: item.updatedAt.toISOString() })) };
}
