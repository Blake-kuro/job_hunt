import { Link } from "@tanstack/react-router";
import { type CourseDetail, type CourseLesson, formatDuration, lessonStatus } from "@entities/course";
import { cn } from "@job-hunt/ui/lib/utils";

interface LessonListProps {
  course: CourseDetail;
  /** 播放页里当前课时高亮 */
  currentId?: string;
  /** 点到「需开通」的课时 */
  onLocked: (lesson: CourseLesson) => void;
  /** 播放页侧栏：更紧凑 */
  compact?: boolean;
}

const toneClass = {
  done: "text-accent-700",
  progress: "text-accent-700",
  locked: "text-neutral-600",
  preview: "text-accent-700",
  pending: "text-neutral-600",
  none: "",
} as const;

/** 行首的小方块：看完实心、在看半填、可播空框、锁定 / 未就绪虚线 */
const markClass = {
  done: "border-accent bg-accent",
  progress: "border-accent bg-[linear-gradient(to_right,var(--color-accent)_50%,transparent_50%)]",
  preview: "border-accent",
  none: "border-divider",
  locked: "border-dashed border-neutral-500",
  pending: "border-dashed border-neutral-500",
} as const;

function LessonRow({
  course,
  lesson,
  index,
  current,
  compact,
  onLocked,
}: {
  course: CourseDetail;
  lesson: CourseLesson;
  index: number;
  current: boolean;
  compact: boolean;
  onLocked: (lesson: CourseLesson) => void;
}) {
  const status = lessonStatus(lesson, course.access);
  const rowClass = cn(
    "grid w-full grid-cols-[0.75rem_2rem_minmax(0,1fr)_auto] items-center gap-x-3 border-t border-hairline text-left first:border-t-0",
    compact ? "px-3 py-2.5 text-[13px]" : "px-1 py-3 text-sm",
    current && "bg-accent-100",
  );
  const body = (
    <>
      <i aria-hidden className={cn("size-2.5 border", markClass[status.tone])} />
      <span className="text-xs tabular-nums text-neutral-600">{String(index).padStart(2, "0")}</span>
      <span className="min-w-0">
        <span className={cn("block truncate", current && "font-medium text-accent-800")}>{lesson.title}</span>
        <span className="mt-0.5 block text-[11px] text-neutral-600">
          {lesson.durationSeconds ? formatDuration(lesson.durationSeconds) : "时长待定"}
        </span>
      </span>
      <span className={cn("shrink-0 text-xs tabular-nums", toneClass[status.tone])}>{status.label}</span>
    </>
  );
  if (lesson.playable) {
    return (
      <li>
        <Link
          to="/courses/$courseId/$lessonId"
          params={{ courseId: course.id, lessonId: lesson.id }}
          aria-current={current ? "page" : undefined}
          className={cn(rowClass, "transition-colors hover:bg-surface")}
        >
          {body}
        </Link>
      </li>
    );
  }
  // 锁定的课时可点（弹开通提示）；视频未就绪的只展示
  const locked = lesson.videoStatus === "READY";
  return (
    <li>
      {locked ? (
        <button
          type="button"
          onClick={() => onLocked(lesson)}
          className={cn(rowClass, "cursor-pointer hover:bg-surface")}
        >
          {body}
        </button>
      ) : (
        <div className={cn(rowClass, "text-neutral-600")}>{body}</div>
      )}
    </li>
  );
}

/** 章节 → 课时列表；未分章的课时排在最后。课程页与播放页侧栏共用。 */
export function LessonList({ course, currentId, onLocked, compact = false }: LessonListProps) {
  let index = 0;
  const sections = [
    ...course.chapters.map((c) => ({ id: c.id, title: c.title, lessons: c.lessons })),
    ...(course.unchaptered.length > 0
      ? [{ id: "__unchaptered", title: course.chapters.length > 0 ? "其他" : "", lessons: course.unchaptered }]
      : []),
  ];
  if (sections.length === 0) return <p className="text-sm text-neutral-700">课程内容整理中，敬请期待。</p>;
  return (
    <div className={cn("flex flex-col", compact ? "gap-4" : "gap-7")}>
      {sections.map((section) => (
        <section key={section.id}>
          {section.title && (
            <h3
              className={cn(
                "font-heading font-semibold",
                compact ? "px-3 pb-1 text-xs text-neutral-700" : "pb-2 text-base",
              )}
            >
              {section.title}
            </h3>
          )}
          <ul className={cn(!compact && "border-y border-divider")}>
            {section.lessons.map((lesson) => {
              index += 1;
              return (
                <LessonRow
                  key={lesson.id}
                  course={course}
                  lesson={lesson}
                  index={index}
                  current={lesson.id === currentId}
                  compact={compact}
                  onLocked={onLocked}
                />
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
