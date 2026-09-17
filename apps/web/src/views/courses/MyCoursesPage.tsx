import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { meQuery } from "@api/queries";
import { accessBadge, formatDuration, type MyCourse, myCoursesQuery } from "@entities/course";
import { Badge } from "@job-hunt/ui/components/badge";
import { Button } from "@job-hunt/ui/components/button";
import { Kicker } from "@job-hunt/ui/components/kicker";
import { ProgressBar } from "@job-hunt/ui/components/progress-bar";
import { Navbar } from "@widgets/navbar/Navbar";
import { CourseCover } from "./CourseCatalogPage";

function Row({ course }: { course: MyCourse }) {
  const badge = accessBadge(course);
  const updated = course.updatedAt ? course.updatedAt.slice(0, 10) : null;
  return (
    <li className="grid grid-cols-1 gap-4 border-t border-divider py-5 first:border-t-0 sm:grid-cols-[200px_minmax(0,1fr)_auto] sm:items-center">
      <Link to="/courses/$courseId" params={{ courseId: course.id }} className="block">
        <CourseCover course={course} className="aspect-video w-full overflow-hidden bg-surface" />
      </Link>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/courses/$courseId"
            params={{ courseId: course.id }}
            className="font-heading text-base font-semibold hover:text-accent"
          >
            {course.title}
          </Link>
          <Badge variant={badge.variant}>{badge.label}</Badge>
        </div>
        <p className="mt-1 text-xs text-neutral-700">
          {course.teacher ?? "职寻教研组"} · {course.lessonCount} 课时 · {formatDuration(course.durationSeconds)}
        </p>
        <ProgressBar value={course.progressPercent ?? 0} className="mt-3 max-w-[420px] bg-neutral-100" />
        <p className="mt-1 text-[11px] tabular-nums text-neutral-600">
          {course.progressPercent === null ? "尚未开始" : `已学 ${course.progressPercent}%`}
          {course.lastLessonTitle && ` · 上次学到：${course.lastLessonTitle}`}
          {updated && ` · ${updated}`}
        </p>
      </div>
      {course.lastLessonId ? (
        <Button asChild variant="primary">
          <Link to="/courses/$courseId/$lessonId" params={{ courseId: course.id, lessonId: course.lastLessonId }}>
            继续学习
          </Link>
        </Button>
      ) : (
        <Button asChild variant="primary">
          <Link to="/courses/$courseId" params={{ courseId: course.id }}>
            开始学习
          </Link>
        </Button>
      )}
    </li>
  );
}

export function MyCoursesPage() {
  const { data } = useSuspenseQuery(myCoursesQuery());
  const { data: user } = useSuspenseQuery(meQuery());
  return (
    <div className="flex min-h-full flex-col bg-bg">
      <Navbar active="courses" />
      <main className="px-4 py-8 sm:px-8 sm:py-9">
        <Kicker className="mb-2 text-accent-700">我的课程</Kicker>
        <h1 className="text-[28px] leading-tight sm:text-[36px]">已开通与学习中的课程</h1>
        {user.tier === "GUEST" && (
          <p className="mt-3 text-sm text-neutral-700">
            当前是游客身份，学习记录只保存在本设备；
            <Link to="/login" search={{ redirect: "/me/courses" }} className="text-accent-700 hover:text-accent-900">
              登录
            </Link>
            后会合并到你的账号。
          </p>
        )}
        {data.items.length === 0 ? (
          <div className="mt-8 flex flex-col items-start gap-3">
            <p className="text-sm text-neutral-700">还没有开始学习任何课程。</p>
            <Button asChild variant="primary">
              <Link to="/courses">去看看网课</Link>
            </Button>
          </div>
        ) : (
          <ul className="mt-6 max-w-[960px] border-b border-divider">
            {data.items.map((course) => (
              <Row key={course.id} course={course} />
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
