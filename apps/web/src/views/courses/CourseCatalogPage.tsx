import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { accessBadge, type CourseCard, coursesQuery, formatDuration } from "@entities/course";
import { Badge } from "@job-hunt/ui/components/badge";
import { Kicker } from "@job-hunt/ui/components/kicker";
import { ProgressBar } from "@job-hunt/ui/components/progress-bar";
import { Navbar } from "@widgets/navbar/Navbar";

export function CourseCover({
  course,
  className,
}: {
  course: Pick<CourseCard, "coverUrl" | "title">;
  className?: string;
}) {
  return (
    <div className={className}>
      {course.coverUrl ? (
        <img src={course.coverUrl} alt="" className="size-full object-cover" loading="lazy" />
      ) : (
        <div className="flex size-full items-center justify-center bg-accent-200 font-heading text-2xl text-accent-800">
          {course.title.slice(0, 1)}
        </div>
      )}
    </div>
  );
}

function Card({ course }: { course: CourseCard }) {
  const badge = accessBadge(course);
  return (
    <li className="border border-divider bg-bg transition-colors hover:border-accent">
      <Link to="/courses/$courseId" params={{ courseId: course.id }} className="block">
        <div className="relative aspect-video w-full overflow-hidden bg-surface">
          <CourseCover course={course} className="size-full" />
          <Badge variant={badge.variant} className="absolute right-2 top-2 bg-bg/90">
            {badge.label}
          </Badge>
        </div>
        <div className="p-4">
          <p className="line-clamp-2 font-heading text-base font-semibold leading-snug">{course.title}</p>
          <p className="mt-1.5 text-xs text-neutral-700">
            {course.teacher ?? "职寻教研组"} · {course.lessonCount} 课时 · {formatDuration(course.durationSeconds)}
          </p>
          {course.access === "GRANTED" && (
            <div className="mt-3">
              <ProgressBar value={course.progressPercent ?? 0} className="bg-neutral-100" />
              <p className="mt-1 text-[11px] tabular-nums text-neutral-600">
                {course.progressPercent === null ? "尚未开始" : `已学 ${course.progressPercent}%`}
              </p>
            </div>
          )}
        </div>
      </Link>
    </li>
  );
}

export function CourseCatalogPage() {
  const { data } = useSuspenseQuery(coursesQuery());
  return (
    <div className="flex min-h-full flex-col bg-bg">
      <Navbar active="courses" />
      <main className="px-4 py-8 sm:px-8 sm:py-9">
        <Kicker className="mb-2 text-accent-700">网课</Kicker>
        <h1 className="text-[28px] leading-tight sm:text-[36px]">系统课程，按章节学</h1>
        <p className="mt-2 text-sm text-neutral-700">免费课直接看；付费课可先试看，开通后解锁全部课时。</p>
        {data.items.length === 0 ? (
          <p className="mt-8 text-sm text-neutral-700">暂无课程，敬请期待。</p>
        ) : (
          <ul className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {data.items.map((course) => (
              <Card key={course.id} course={course} />
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
