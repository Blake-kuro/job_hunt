import { useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import { meQuery } from "@api/queries";
import { accessBadge, courseQuery, formatDuration, formatPrice } from "@entities/course";
import { continueLessonId } from "@features/video-player/progress";
import { Badge } from "@job-hunt/ui/components/badge";
import { Button } from "@job-hunt/ui/components/button";
import { Kicker } from "@job-hunt/ui/components/kicker";
import { ProgressBar } from "@job-hunt/ui/components/progress-bar";
import { LessonList } from "@widgets/lesson-list/LessonList";
import { Navbar } from "@widgets/navbar/Navbar";
import { CourseCover } from "./CourseCatalogPage";
import { EnrollDialog } from "./EnrollDialog";

const route = getRouteApi("/courses_/$courseId");

export function CoursePage() {
  const { courseId } = route.useParams();
  const { data: course } = useSuspenseQuery(courseQuery(courseId));
  const { data: user } = useSuspenseQuery(meQuery());
  const [enrollOpen, setEnrollOpen] = useState(false);
  const badge = accessBadge(course);
  const granted = course.access === "GRANTED";
  const continueId = granted ? continueLessonId(course) : null;
  const started = course.progressPercent !== null;

  return (
    <div className="flex min-h-full flex-col bg-bg">
      <Navbar active="courses" />
      <main className="px-4 py-8 sm:px-8 sm:py-9">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Link to="/courses" className="text-accent-700 hover:text-accent-900">
            网课
          </Link>
          <span className="text-neutral-600">›</span>
          <span className="truncate">{course.title}</span>
        </div>

        <header className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-[320px_minmax(0,1fr)]">
          <CourseCover course={course} className="aspect-video w-full overflow-hidden bg-surface" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Kicker className="text-accent-700">课程</Kicker>
              <Badge variant={badge.variant}>{badge.label}</Badge>
            </div>
            <h1 className="mt-2 text-[26px] leading-tight sm:text-[34px]">{course.title}</h1>
            <p className="mt-2 text-xs text-neutral-700">
              {course.teacher ?? "职寻教研组"} · {course.lessonCount} 课时 · {formatDuration(course.durationSeconds)}
              {!granted && course.freePreviewCount > 0 && ` · ${course.freePreviewCount} 节可试看`}
            </p>
            {course.summary && <p className="mt-3 max-w-[640px] text-[15px] text-neutral-700">{course.summary}</p>}
            <div className="mt-5 flex flex-wrap items-center gap-4">
              {granted ? (
                continueId ? (
                  <Button asChild variant="primary" size="lg" blueprint>
                    <Link to="/courses/$courseId/$lessonId" params={{ courseId: course.id, lessonId: continueId }}>
                      {started ? "继续学习" : "开始学习"}
                    </Link>
                  </Button>
                ) : (
                  <Button size="lg" disabled>
                    暂无可播课时
                  </Button>
                )
              ) : (
                <Button variant="primary" size="lg" blueprint onClick={() => setEnrollOpen(true)}>
                  {formatPrice(course.priceCents)} · 联系开通
                </Button>
              )}
              {granted && started && (
                <div className="min-w-[160px]">
                  <ProgressBar value={course.progressPercent ?? 0} className="bg-neutral-100" />
                  <p className="mt-1 text-[11px] tabular-nums text-neutral-600">已学 {course.progressPercent}%</p>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <section>
            <Kicker className="mb-3 text-accent-700">课程介绍</Kicker>
            <p className="whitespace-pre-line text-sm leading-relaxed text-neutral-700">
              {course.description ?? course.summary ?? "暂无介绍。"}
            </p>
          </section>
          <section>
            <Kicker className="mb-3 text-accent-700">章节目录</Kicker>
            <LessonList course={course} onLocked={() => setEnrollOpen(true)} />
          </section>
        </div>
      </main>
      <EnrollDialog
        open={enrollOpen}
        onClose={() => setEnrollOpen(false)}
        courseTitle={course.title}
        priceCents={course.priceCents}
        guest={user.tier === "GUEST"}
        redirectTo={`/courses/${course.id}`}
      />
    </div>
  );
}
