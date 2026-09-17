import { z } from "@hono/zod-openapi";

/** 当前用户对某门课的权限：已开通（免费 / 有授权 / 管理员）、仅可试看、锁定 */
export const CourseAccessSchema = z.enum(["GRANTED", "PREVIEW", "LOCKED"]).openapi("CourseAccess");
export type CourseAccess = z.infer<typeof CourseAccessSchema>;

export const VideoStatusSchema = z.enum(["NONE", "UPLOADING", "PROCESSING", "READY", "FAILED"]).openapi("VideoStatus");
export type VideoStatusValue = z.infer<typeof VideoStatusSchema>;

const courseCardShape = {
  id: z.string(),
  title: z.string(),
  summary: z.string().nullable(),
  coverUrl: z.string().nullable(),
  teacher: z.string().nullable(),
  /** 标价，分；0 = 免费 */
  priceCents: z.number().int(),
  lessonCount: z.number().int(),
  /** 已就绪课时时长之和，秒 */
  durationSeconds: z.number().int(),
  freePreviewCount: z.number().int(),
  access: CourseAccessSchema,
  /** 已完成课时占比 0–100；没有任何进度时为 null */
  progressPercent: z.number().int().nullable(),
};
export const CourseCardSchema = z.object(courseCardShape).openapi("CourseCard");
export type CourseCard = z.infer<typeof CourseCardSchema>;

export const CourseCatalogSchema = z.object({ items: z.array(CourseCardSchema) }).openapi("CourseCatalog");

export const LessonProgressSchema = z
  .object({ positionSeconds: z.number().int(), completed: z.boolean() })
  .openapi("LessonProgress");

/** 学生视角的课时 */
export const CourseLessonSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    durationSeconds: z.number().int().nullable(),
    freePreview: z.boolean(),
    videoStatus: VideoStatusSchema,
    /** `videoStatus === "READY" && (access === "GRANTED" || freePreview)` */
    playable: z.boolean(),
    progress: z.union([LessonProgressSchema, z.null()]),
  })
  .openapi("CourseLesson");
export type CourseLesson = z.infer<typeof CourseLessonSchema>;

export const CourseChapterSchema = z
  .object({ id: z.string(), title: z.string(), lessons: z.array(CourseLessonSchema) })
  .openapi("CourseChapter");

export const CourseDetailSchema = z
  .object({
    ...courseCardShape,
    description: z.string().nullable(),
    chapters: z.array(CourseChapterSchema),
    /** 不属于任何章的课时 */
    unchaptered: z.array(CourseLessonSchema),
    /** 最近学习的课时；没有进度时为 null */
    lastLessonId: z.string().nullable(),
  })
  .openapi("CourseDetail");
export type CourseDetail = z.infer<typeof CourseDetailSchema>;

export const PlayInfoSchema = z
  .object({
    appId: z.string(),
    fileId: z.string(),
    /** 超级播放器签名（mock 下为 "mock-play"） */
    psign: z.string(),
    expiresAt: z.string().datetime(),
    /** 续播位置 */
    positionSeconds: z.number().int(),
  })
  .openapi("PlayInfo");

export const MAX_POSITION_SECONDS = 7 * 24 * 3600;
export const LessonProgressBodySchema = z
  .object({
    /** 秒；上限 7 天，越界 400 而不是写库溢出 */
    positionSeconds: z.number().int().min(0).max(MAX_POSITION_SECONDS),
    completed: z.boolean().optional(),
  })
  .openapi("LessonProgressBody");
export type LessonProgressBody = z.infer<typeof LessonProgressBodySchema>;

export const MyCourseSchema = z
  .object({
    ...courseCardShape,
    lastLessonId: z.string().nullable(),
    lastLessonTitle: z.string().nullable(),
    /** 最近学习时间；只有授权没有进度时为授权时间 */
    updatedAt: z.string().datetime(),
  })
  .openapi("MyCourse");
export const MyCoursesSchema = z.object({ items: z.array(MyCourseSchema) }).openapi("MyCourses");

// ── 腾讯云 VOD 事件回调 ──
export const VodCallbackBodySchema = z
  .object({
    EventType: z.string(),
    ProcedureStateChangeEvent: z
      .object({
        FileId: z.string(),
        /** PROCESSING / FINISH */
        Status: z.string(),
        ErrCode: z.number().int().optional(),
        Message: z.string().optional(),
        MetaData: z.object({ Duration: z.number().optional() }).nullable().optional(),
        MediaProcessResultSet: z
          .array(
            z.object({
              Type: z.string(),
              CoverBySnapshotTask: z
                .object({
                  Status: z.string().optional(),
                  ErrCode: z.number().int().optional(),
                  Output: z.object({ CoverUrl: z.string().optional() }).nullable().optional(),
                })
                .nullable()
                .optional(),
            }),
          )
          .nullable()
          .optional(),
      })
      .nullable()
      .optional(),
  })
  .openapi("VodCallbackBody");
export type VodCallbackBody = z.infer<typeof VodCallbackBodySchema>;
export const VodCallbackResultSchema = z
  .object({
    /** 是否命中了某个课时并更新了状态 */
    handled: z.boolean(),
  })
  .openapi("VodCallbackResult");
