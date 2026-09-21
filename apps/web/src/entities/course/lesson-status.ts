import type { CourseAccess, CourseLesson } from "@job-hunt/api-client/types";

export type LessonStatusTone = "done" | "progress" | "locked" | "preview" | "pending" | "none";

export interface LessonStatus {
  label: string;
  tone: LessonStatusTone;
}

/** 课时行进度百分比（0–100）；没有进度或不知道时长时 null；未完成最多显示 99 */
export function lessonPercent(lesson: Pick<CourseLesson, "durationSeconds" | "progress">): number | null {
  if (!lesson.progress) return null;
  if (lesson.progress.completed) return 100;
  if (!lesson.durationSeconds) return null;
  return Math.min(99, Math.round((lesson.progress.positionSeconds / lesson.durationSeconds) * 100));
}

/** 课时行右侧状态：已看完 / 进度% / 需开通 / 试看 / 处理中 */
export function lessonStatus(
  lesson: Pick<CourseLesson, "durationSeconds" | "progress" | "freePreview" | "videoStatus" | "playable">,
  access: CourseAccess,
): LessonStatus {
  if (lesson.progress?.completed) return { label: "已看完", tone: "done" };
  if (lesson.videoStatus !== "READY") {
    if (lesson.videoStatus === "NONE") return { label: "暂无视频", tone: "pending" };
    if (lesson.videoStatus === "FAILED") return { label: "视频异常", tone: "pending" };
    return { label: "处理中", tone: "pending" };
  }
  if (!lesson.playable) return { label: "需开通", tone: "locked" };
  const percent = lessonPercent(lesson);
  if (percent !== null && percent > 0) return { label: `${percent}%`, tone: "progress" };
  if (lesson.freePreview && access !== "GRANTED") return { label: "试看", tone: "preview" };
  return { label: "", tone: "none" };
}
