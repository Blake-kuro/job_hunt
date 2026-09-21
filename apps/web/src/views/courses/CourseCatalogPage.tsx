import { useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { meQuery } from "@api/queries";
import {
  accessBadge,
  type CourseCard,
  coursesQuery,
  formatDuration,
  formatPrice,
  myCoursesQuery,
} from "@entities/course";
import { Badge } from "@job-hunt/ui/components/badge";
import { Kicker } from "@job-hunt/ui/components/kicker";
import { ProgressBar } from "@job-hunt/ui/components/progress-bar";
import { Segmented } from "@job-hunt/ui/components/segmented";
import { cn } from "@job-hunt/ui/lib/utils";
import { Navbar } from "@widgets/navbar/Navbar";
import { StudyPanel } from "@widgets/study-panel/StudyPanel";

export function CourseCover({
  course,
  className,
}: {
  course: Pick<CourseCard, "coverUrl" | "title">;
  className?: string;
}) {
  return (
    <div className={cn("relative overflow-hidden bg-surface", className)}>
      {course.coverUrl ? (
        <img src={course.coverUrl} alt="" className="size-full object-cover" loading="lazy" />
      ) : (
        // 没有封面时用首字做「图纸」式占位：浅蓝底 + 细网格 + 大字
        <div className="flex size-full items-center justify-center bg-accent-100 bg-[linear-gradient(to_right,var(--color-accent-200)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-accent-200)_1px,transparent_1px)] bg-[size:24px_24px]">
          <span className="font-heading text-[44px] leading-none text-accent-800">{course.title.slice(0, 1)}</span>
        </div>
      )}
    </div>
  );
}

type Filter = "all" | "free" | "mine";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "全部" },
  { value: "free", label: "免费" },
  { value: "mine", label: "已开通" },
];

function matches(course: CourseCard, filter: Filter): boolean {
  if (filter === "free") return course.priceCents === 0;
  if (filter === "mine") return course.access === "GRANTED";
  return true;
}

function Card({ course }: { course: CourseCard }) {
  const badge = accessBadge(course);
  const granted = course.access === "GRANTED";
  return (
    <li className="flex flex-col border border-divider bg-bg transition-colors hover:border-accent">
      <Link to="/courses/$courseId" params={{ courseId: course.id }} className="flex h-full flex-col">
        <CourseCover course={course} className="aspect-[16/9] w-full" />
        <div className="flex flex-1 flex-col p-4">
          <div className="flex items-start justify-between gap-3">
            <p className="line-clamp-2 font-heading text-base font-semibold leading-snug">{course.title}</p>
            <Badge variant={badge.variant} className="shrink-0">
              {badge.label}
            </Badge>
          </div>
          {course.summary && (
            <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-neutral-700">{course.summary}</p>
          )}
          <div className="mt-auto pt-4">
            {granted ? (
              <>
                <ProgressBar value={course.progressPercent ?? 0} className="bg-neutral-100" />
                <div className="mt-1.5 flex items-center justify-between text-[11px] tabular-nums text-neutral-600">
                  <span>{course.progressPercent === null ? "尚未开始" : `已学 ${course.progressPercent}%`}</span>
                  <span>
                    {course.lessonCount} 课时 · {formatDuration(course.durationSeconds)}
                  </span>
                </div>
              </>
            ) : (
              <div className="flex items-end justify-between gap-3 border-t border-hairline pt-3">
                <div className="text-[11px] text-neutral-600">
                  <p>{course.teacher ?? "职寻教研组"}</p>
                  <p className="mt-0.5 tabular-nums">
                    {course.lessonCount} 课时 · {formatDuration(course.durationSeconds)}
                    {course.freePreviewCount > 0 && ` · ${course.freePreviewCount} 节试看`}
                  </p>
                </div>
                <span className="font-heading text-lg leading-none tabular-nums text-accent-800">
                  {formatPrice(course.priceCents)}
                </span>
              </div>
            )}
          </div>
        </div>
      </Link>
    </li>
  );
}

export function CourseCatalogPage() {
  const { data } = useSuspenseQuery(coursesQuery());
  const { data: mine } = useSuspenseQuery(myCoursesQuery());
  const { data: user } = useSuspenseQuery(meQuery());
  const [filter, setFilter] = useState<Filter>("all");

  const freeCount = data.items.filter((c) => c.priceCents === 0).length;
  const shown = data.items.filter((c) => matches(c, filter));

  return (
    <div className="flex min-h-full flex-col bg-bg">
      <Navbar active="courses" />

      <section className="grid grid-cols-1 items-end gap-8 border-b border-divider px-4 pb-7 pt-8 sm:px-8 sm:pt-10 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-10">
        <div>
          <Kicker className="mb-2.5 text-accent-700">网课</Kicker>
          <h1 className="text-balance text-[32px] sm:text-[42px] lg:text-[52px]">求职要学的，按章节讲一遍</h1>
          <p className="mt-3.5 max-w-[640px] text-[15px] text-neutral-700">
            简历、笔试、面试分门别类录成短课，免费课直接看；付费课先试看第一节，开通后解锁全部课时，进度自动记住。
          </p>
          <Segmented name="course-filter" options={FILTERS} value={filter} onChange={setFilter} className="mt-5" />
        </div>
        <StudyPanel courses={mine.items} guest={user.tier === "GUEST"} />
      </section>

      <div className="flex flex-col gap-2 border-b border-divider bg-accent-100 px-4 py-3 sm:flex-row sm:items-center sm:gap-3.5 sm:px-8">
        <Badge className="self-start bg-accent text-bg">课程</Badge>
        <p className="text-sm">
          共 <b className="tabular-nums">{data.items.length}</b> 门课，其中免费{" "}
          <b className="tabular-nums">{freeCount}</b> 门；付费课每节都标了时长，先试看再决定
        </p>
        <div className="flex-1" />
        <Link to="/me/courses" className="self-start text-[13px] text-accent-700 hover:text-accent-900 sm:self-auto">
          我的课程 →
        </Link>
      </div>

      <main className="px-4 py-7 sm:px-8">
        {shown.length === 0 ? (
          <p className="text-sm text-neutral-700">
            {filter === "mine" ? "还没有开通任何付费课；免费课随时可以看。" : "暂无课程，敬请期待。"}
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {shown.map((course) => (
              <Card key={course.id} course={course} />
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
