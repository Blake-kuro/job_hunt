import type {
  AdminChapterPatch,
  AdminCourse,
  AdminCourseBody,
  AdminCourseDetail,
  AdminCourseGrantBody,
  AdminCoursePatch,
  AdminCourseStudent,
  AdminLesson,
  AdminLessonBody,
  AdminLessonOrderBody,
  AdminLessonPatch,
} from "../contract";
import { prisma } from "../db";
import { AppError, NotFoundError } from "../lib/errors";
import { orNotFound } from "../lib/route";
import { fetchMediaInfo } from "../lib/vod";

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

const lessonSelect = {
  id: true,
  chapterId: true,
  title: true,
  sortOrder: true,
  freePreview: true,
  videoFileId: true,
  videoStatus: true,
  durationSeconds: true,
} as const;
const LESSON_ORDER = [{ sortOrder: "asc" as const }, { id: "asc" as const }];

const courseSelect = {
  id: true,
  title: true,
  summary: true,
  coverUrl: true,
  teacher: true,
  priceCents: true,
  published: true,
  sortOrder: true,
  createdAt: true,
  updatedAt: true,
  lessons: { select: { videoStatus: true } },
} as const;
type CourseRow = {
  id: string;
  title: string;
  summary: string | null;
  coverUrl: string | null;
  teacher: string | null;
  priceCents: number;
  published: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
  lessons: { videoStatus: string }[];
};

/** `AccessGrant{COURSE}` 按课程分组计数（含已过期） */
async function grantCounts(courseIds: string[]) {
  if (courseIds.length === 0) return new Map<string, number>();
  const rows = await prisma.accessGrant.groupBy({
    by: ["contentId"],
    where: { contentType: "COURSE", contentId: { in: courseIds } },
    _count: { _all: true },
  });
  return new Map(rows.map((r) => [r.contentId, r._count._all]));
}

function toAdminCourse(course: CourseRow, grantCount: number): AdminCourse {
  return {
    id: course.id,
    title: course.title,
    summary: course.summary,
    coverUrl: course.coverUrl,
    teacher: course.teacher,
    priceCents: course.priceCents,
    published: course.published,
    sortOrder: course.sortOrder,
    lessonCount: course.lessons.length,
    readyCount: course.lessons.filter((l) => l.videoStatus === "READY").length,
    grantCount,
    createdAt: course.createdAt.toISOString(),
    updatedAt: course.updatedAt.toISOString(),
  };
}

export async function requireCourse(id: string) {
  return orNotFound(await prisma.course.findUnique({ where: { id }, select: { id: true } }), `课程 ${id} 不存在`);
}

// ── 课程 ──

export async function listCourses(query: {
  q?: string;
  published?: boolean;
  page: number;
  pageSize: number;
}): Promise<{ items: AdminCourse[]; total: number; page: number; pageSize: number }> {
  const { q, published, page, pageSize } = query;
  const where = {
    ...(published !== undefined && { published }),
    ...(q && { OR: [{ title: { contains: q } }, { teacher: { contains: q } }] }),
  };
  const [total, rows] = await Promise.all([
    prisma.course.count({ where }),
    prisma.course.findMany({
      where,
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }, { id: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: courseSelect,
    }),
  ]);
  const grants = await grantCounts(rows.map((r) => r.id));
  return { items: rows.map((r) => toAdminCourse(r, grants.get(r.id) ?? 0)), total, page, pageSize };
}

export async function getCourse(id: string): Promise<AdminCourseDetail> {
  const course = orNotFound(
    await prisma.course.findUnique({
      where: { id },
      select: {
        ...courseSelect,
        description: true,
        chapters: {
          orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
          select: { id: true, title: true, sortOrder: true },
        },
        lessons: { orderBy: LESSON_ORDER, select: lessonSelect },
      },
    }),
    `课程 ${id} 不存在`,
  );
  const grants = await grantCounts([id]);
  const lessonsOf = (chapterId: string | null) => course.lessons.filter((l) => l.chapterId === chapterId);
  return {
    ...toAdminCourse(course, grants.get(id) ?? 0),
    description: course.description,
    chapters: course.chapters.map((ch) => ({ ...ch, lessons: lessonsOf(ch.id) })),
    unchaptered: lessonsOf(null),
  };
}

const courseData = (b: AdminCoursePatch) => ({
  ...(b.title !== undefined && { title: b.title }),
  ...(b.summary !== undefined && { summary: b.summary }),
  ...(b.description !== undefined && { description: b.description }),
  ...(b.teacher !== undefined && { teacher: b.teacher }),
  ...(b.priceCents !== undefined && { priceCents: b.priceCents }),
  ...(b.coverUrl !== undefined && { coverUrl: b.coverUrl }),
  ...(b.published !== undefined && { published: b.published }),
  ...(b.sortOrder !== undefined && { sortOrder: b.sortOrder }),
});

export async function createCourse(body: AdminCourseBody): Promise<string> {
  const created = await prisma.course.create({
    data: { ...courseData(body), title: body.title, priceCents: body.priceCents, published: body.published },
    select: { id: true },
  });
  return created.id;
}

/** 只写提供的字段；`null` 清空 */
export async function updateCourse(id: string, body: AdminCoursePatch): Promise<void> {
  await requireCourse(id);
  await prisma.course.update({ where: { id }, data: courseData(body) });
}

/** 级联删章 / 课时 / 进度，并在同一事务里清掉该课的 `AccessGrant{COURSE}` */
export async function deleteCourse(id: string): Promise<void> {
  await requireCourse(id);
  await prisma.$transaction(async (tx) => {
    await tx.course.delete({ where: { id } });
    await tx.accessGrant.deleteMany({ where: { contentType: "COURSE", contentId: id } });
  });
}

// ── 章 ──

async function nextChapterOrder(tx: Tx, courseId: string) {
  const last = await tx.courseChapter.aggregate({ where: { courseId }, _max: { sortOrder: true } });
  return (last._max.sortOrder ?? -1) + 1;
}
async function nextLessonOrder(tx: Tx, courseId: string) {
  const last = await tx.courseLesson.aggregate({ where: { courseId }, _max: { sortOrder: true } });
  return (last._max.sortOrder ?? -1) + 1;
}

/** 新章排到该课最后 */
export async function createChapter(courseId: string, title: string): Promise<string> {
  await requireCourse(courseId);
  return prisma.$transaction(async (tx) => {
    const created = await tx.courseChapter.create({
      data: { courseId, title, sortOrder: await nextChapterOrder(tx, courseId) },
      select: { id: true },
    });
    return created.id;
  });
}

async function requireChapter(id: string) {
  return orNotFound(
    await prisma.courseChapter.findUnique({ where: { id }, select: { id: true, courseId: true } }),
    `章 ${id} 不存在`,
  );
}

export async function updateChapter(id: string, body: AdminChapterPatch): Promise<void> {
  await requireChapter(id);
  await prisma.courseChapter.update({ where: { id }, data: body });
}

/** 删章不删课时：外键 `onDelete: SetNull`，课时回到「无章」 */
export async function deleteChapter(id: string): Promise<void> {
  await requireChapter(id);
  await prisma.courseChapter.delete({ where: { id } });
}

// ── 课时 ──

/** `chapterId` 非空时必须是该课的章，否则 400 */
async function assertChapterInCourse(courseId: string, chapterId: string | null | undefined) {
  if (!chapterId) return;
  const chapter = await prisma.courseChapter.findUnique({ where: { id: chapterId }, select: { courseId: true } });
  if (!chapter || chapter.courseId !== courseId) throw new AppError(400, "VALIDATION", `章 ${chapterId} 不属于该课程`);
}

/** 新课时排到该课最后 */
export async function createLesson(courseId: string, body: AdminLessonBody): Promise<string> {
  await requireCourse(courseId);
  await assertChapterInCourse(courseId, body.chapterId);
  return prisma.$transaction(async (tx) => {
    const created = await tx.courseLesson.create({
      data: {
        courseId,
        title: body.title,
        chapterId: body.chapterId ?? null,
        freePreview: body.freePreview ?? false,
        sortOrder: await nextLessonOrder(tx, courseId),
      },
      select: { id: true },
    });
    return created.id;
  });
}

async function requireLesson(id: string) {
  return orNotFound(
    await prisma.courseLesson.findUnique({ where: { id }, select: { id: true, courseId: true, videoFileId: true } }),
    `课时 ${id} 不存在`,
  );
}

/** 写 `videoFileId` 即视为直传完成，状态置 PROCESSING、时长清空，等回调 / 刷新回填 */
export async function updateLesson(id: string, body: AdminLessonPatch): Promise<void> {
  const lesson = await requireLesson(id);
  if (body.chapterId !== undefined) await assertChapterInCourse(lesson.courseId, body.chapterId);
  await prisma.courseLesson.update({
    where: { id },
    data: {
      ...(body.title !== undefined && { title: body.title }),
      ...(body.chapterId !== undefined && { chapterId: body.chapterId }),
      ...(body.sortOrder !== undefined && { sortOrder: body.sortOrder }),
      ...(body.freePreview !== undefined && { freePreview: body.freePreview }),
      ...(body.videoFileId !== undefined && {
        videoFileId: body.videoFileId,
        videoStatus: "PROCESSING" as const,
        durationSeconds: null,
      }),
    },
  });
}

export async function deleteLesson(id: string): Promise<void> {
  await requireLesson(id);
  await prisma.courseLesson.delete({ where: { id } });
}

/**
 * 一次性写整门课的结构：`chapters` 的数组顺序即章顺序，各章 `lessonIds` 与 `unchaptered`
 * 决定课时归属与顺序。章与课时都必须恰好覆盖该课全部且不重复，否则 400。
 */
export async function reorderLessons(courseId: string, body: AdminLessonOrderBody): Promise<void> {
  await requireCourse(courseId);
  const [chapters, lessons] = await Promise.all([
    prisma.courseChapter.findMany({ where: { courseId }, select: { id: true } }),
    prisma.courseLesson.findMany({ where: { courseId }, select: { id: true } }),
  ]);
  const chapterIds = new Set(chapters.map((c) => c.id));
  const submittedChapters = body.chapters.map((ch) => ch.id);
  if (new Set(submittedChapters).size !== submittedChapters.length) throw new AppError(400, "VALIDATION", "章 id 重复");
  for (const id of submittedChapters) {
    if (!chapterIds.has(id)) throw new AppError(400, "VALIDATION", `章 ${id} 不属于该课程`);
  }
  if (submittedChapters.length !== chapterIds.size) throw new AppError(400, "VALIDATION", "章列表必须覆盖该课程全部章");
  const submitted = [...body.chapters.flatMap((ch) => ch.lessonIds), ...body.unchaptered];
  const lessonIds = new Set(lessons.map((l) => l.id));
  if (new Set(submitted).size !== submitted.length) throw new AppError(400, "VALIDATION", "课时 id 重复");
  for (const id of submitted) {
    if (!lessonIds.has(id)) throw new AppError(400, "VALIDATION", `课时 ${id} 不属于该课程`);
  }
  if (submitted.length !== lessonIds.size) throw new AppError(400, "VALIDATION", "课时列表必须覆盖该课程全部课时");

  const writes: { id: string; chapterId: string | null; sortOrder: number }[] = [];
  let order = 0;
  for (const ch of body.chapters)
    for (const id of ch.lessonIds) writes.push({ id, chapterId: ch.id, sortOrder: order++ });
  for (const id of body.unchaptered) writes.push({ id, chapterId: null, sortOrder: order++ });
  await prisma.$transaction([
    ...body.chapters.map((ch, i) => prisma.courseChapter.update({ where: { id: ch.id }, data: { sortOrder: i } })),
    ...writes.map((w) =>
      prisma.courseLesson.update({ where: { id: w.id }, data: { chapterId: w.chapterId, sortOrder: w.sortOrder } }),
    ),
  ]);
}

/** 查 VOD 媒体信息回填 `videoStatus / durationSeconds`（回调没到时手动刷新）；没有 `videoFileId` → 400 */
export async function refreshLessonVideo(id: string): Promise<AdminLesson> {
  const lesson = await requireLesson(id);
  if (!lesson.videoFileId) throw new AppError(400, "VALIDATION", "该课时还没有上传视频");
  const media = await fetchMediaInfo(lesson.videoFileId);
  return prisma.courseLesson.update({
    where: { id },
    data: {
      videoStatus: media.status,
      ...(media.status === "READY" && media.durationSeconds !== null && { durationSeconds: media.durationSeconds }),
    },
    select: lessonSelect,
  });
}

// ── 按课授权 ──

export async function listCourseStudents(
  courseId: string,
  query: { page: number; pageSize: number },
): Promise<{ items: AdminCourseStudent[]; total: number; page: number; pageSize: number }> {
  await requireCourse(courseId);
  const { page, pageSize } = query;
  const where = { contentType: "COURSE" as const, contentId: courseId };
  const [total, grants, lessonCount] = await Promise.all([
    prisma.accessGrant.count({ where }),
    prisma.accessGrant.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        userId: true,
        createdAt: true,
        expiresAt: true,
        user: {
          select: { name: true, identities: { where: { provider: "PHONE" }, select: { providerKey: true } } },
        },
      },
    }),
    prisma.courseLesson.count({ where: { courseId } }),
  ]);
  const progress = await prisma.lessonProgress.groupBy({
    by: ["userId"],
    where: { courseId, userId: { in: grants.map((g) => g.userId) } },
    _count: { _all: true },
    _max: { updatedAt: true },
  });
  const completed = await prisma.lessonProgress.groupBy({
    by: ["userId"],
    where: { courseId, completed: true, userId: { in: grants.map((g) => g.userId) } },
    _count: { _all: true },
  });
  const byUser = new Map(progress.map((p) => [p.userId, p]));
  const completedByUser = new Map(completed.map((p) => [p.userId, p._count._all]));
  const items = grants.map((g) => {
    const p = byUser.get(g.userId);
    return {
      userId: g.userId,
      name: g.user.name,
      phone: g.user.identities[0]?.providerKey ?? null,
      grantedAt: g.createdAt.toISOString(),
      expiresAt: g.expiresAt?.toISOString() ?? null,
      progressPercent:
        p && lessonCount > 0 ? Math.round(((completedByUser.get(g.userId) ?? 0) / lessonCount) * 100) : null,
      lastActiveAt: p?._max.updatedAt?.toISOString() ?? null,
    };
  });
  return { items, total, page, pageSize };
}

/**
 * 批量开通，幂等：不存在的授权 `createMany skipDuplicates`；已有的只在传了 `expiresAt` 时更新到期；
 * 只接受启用的 STUDENT，不存在 / 管理员 / 已停用 → 400 并列出
 */
export async function grantCourse(courseId: string, body: AdminCourseGrantBody, grantedById: string): Promise<void> {
  await requireCourse(courseId);
  const userIds = [...new Set(body.userIds)];
  const users = await prisma.user.findMany({
    where: { id: { in: userIds }, role: "STUDENT", enabled: true },
    select: { id: true },
  });
  const known = new Set(users.map((u) => u.id));
  const missing = userIds.filter((id) => !known.has(id));
  if (missing.length) throw new AppError(400, "VALIDATION", `学生不存在或不可授权：${missing.join(", ")}`);
  const expiresAt = body.expiresAt === undefined ? undefined : body.expiresAt && new Date(body.expiresAt);
  await prisma.$transaction(async (tx) => {
    if (expiresAt !== undefined) {
      await tx.accessGrant.updateMany({
        where: { contentType: "COURSE", contentId: courseId, userId: { in: userIds } },
        data: { expiresAt },
      });
    }
    await tx.accessGrant.createMany({
      data: userIds.map((userId) => ({
        userId,
        contentType: "COURSE" as const,
        contentId: courseId,
        expiresAt: expiresAt ?? null,
        grantedById,
      })),
      skipDuplicates: true,
    });
  });
}

/** 移除授权；课程或授权不存在 → 404 */
export async function revokeCourseGrant(courseId: string, userId: string): Promise<void> {
  await requireCourse(courseId);
  const { count } = await prisma.accessGrant.deleteMany({
    where: { contentType: "COURSE", contentId: courseId, userId },
  });
  if (count === 0) throw new NotFoundError(`学生 ${userId} 没有该课程的授权`);
}
