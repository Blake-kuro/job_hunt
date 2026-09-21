import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { meQuery } from "@api/queries";
import { accessBadge, formatDuration, type MyCourse, myCoursesQuery } from "@entities/course";
import { Badge } from "@job-hunt/ui/components/badge";
import { Button } from "@job-hunt/ui/components/button";
import { Kicker } from "@job-hunt/ui/components/kicker";
import { ProgressBar } from "@job-hunt/ui/components/progress-bar";
import { Navbar } from "@widgets/navbar/Navbar";
import { StudyPanel } from "@widgets/study-panel/StudyPanel";
import { CourseCover } from "./CourseCatalogPage";

function Row({ course }: { course: MyCourse }) {
  const badge = accessBadge(course);
  const updated = course.updatedAt ? course.updatedAt.slice(0, 10) : null;
  const percent = course.progressPercent;
  return (
    <li className="grid grid-cols-1 gap-4 border-t border-divider py-5 first:border-t-0 sm:grid-cols-[200px_minmax(0,1fr)_auto] sm:items-center">
      <Link to="/courses/$courseId" params={{ courseId: course.id }} className="block">
        <CourseCover course={course} className="aspect-[16/9] w-full" />
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
        <p className="mt-1 text-xs tabular-nums text-neutral-700">
          {course.teacher ?? "职寻教研组"} · {course.lessonCount} 课时 · {formatDuration(course.durationSeconds)}
        </p>
        <div className="mt-3 flex max-w-[420px] items-center gap-3">
          <ProgressBar value={percent ?? 0} className="flex-1 bg-neutral-100" />
          <span className="w-10 shrink-0 text-right font-heading text-sm tabular-nums">{percent ?? 0}%</span>
        </div>
        <p className="mt-1 text-[11px] text-neutral-600">
          {percent === null ? "尚未开始" : percent === 100 ? "已学完" : `上次学到：${course.lastLessonTitle ?? "—"}`}
          {updated && ` · ${updated}`}
        </p>
      </div>
      {course.lastLessonId ? (
        <Button asChild variant="primary">
          <Link to="/courses/$courseId/$lessonId" params={{ courseId: course.id, lessonId: course.lastLessonId }}>
            {percent === 100 ? "再看一遍" : "继续学习"}
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
  const guest = user.tier === "GUEST";
  return (
    <div className="flex min-h-full flex-col bg-bg">
      <Navbar active="courses" />

      <section className="grid grid-cols-1 items-end gap-8 border-b border-divider px-4 pb-7 pt-8 sm:px-8 sm:pt-10 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-10">
        <div>
          <Kicker className="mb-2.5 text-accent-700">我的课程</Kicker>
          <h1 className="text-balance text-[32px] sm:text-[42px]">学到哪，记到哪</h1>
          <p className="mt-3.5 max-w-[640px] text-[15px] text-neutral-700">
            {guest ? (
              <>
                当前是游客身份，学习记录只保存在本设备；
                <Link
                  to="/login"
                  search={{ redirect: "/me/courses" }}
                  className="text-accent-700 hover:text-accent-900"
                >
                  登录
                </Link>
                后会合并到你的账号。
              </>
            ) : (
              "已开通和看过的课都在这里，播放进度按课时保存，换设备也能接着看。"
            )}
          </p>
        </div>
        <StudyPanel courses={data.items} guest={guest} />
      </section>

      <main className="px-4 py-7 sm:px-8">
        {data.items.length === 0 ? (
          <div className="flex flex-col items-start gap-3">
            <p className="text-sm text-neutral-700">还没有开始学习任何课程。</p>
            <Button asChild variant="primary">
              <Link to="/courses">去看看网课</Link>
            </Button>
          </div>
        ) : (
          <ul className="max-w-[960px] border-b border-divider">
            {data.items.map((course) => (
              <Row key={course.id} course={course} />
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
