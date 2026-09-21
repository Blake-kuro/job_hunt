import { useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import { meQuery } from "@api/queries";
import { accessBadge, type CourseDetail, courseQuery, formatDuration, formatPrice } from "@entities/course";
import { continueLessonId, flattenLessons } from "@features/video-player/progress";
import { Badge } from "@job-hunt/ui/components/badge";
import { BlueprintPanel, BlueprintStat } from "@job-hunt/ui/components/blueprint-panel";
import { Button } from "@job-hunt/ui/components/button";
import { Kicker } from "@job-hunt/ui/components/kicker";
import { ProgressBar } from "@job-hunt/ui/components/progress-bar";
import { LessonList } from "@widgets/lesson-list/LessonList";
import { Navbar } from "@widgets/navbar/Navbar";
import { CourseCover } from "./CourseCatalogPage";
import { EnrollDialog } from "./EnrollDialog";

const route = getRouteApi("/courses_/$courseId");

/** 已开通：进度面板；未开通：价格 + 试看信息 */
function CoursePanel({ course, onEnroll }: { course: CourseDetail; onEnroll: () => void }) {
  const lessons = flattenLessons(course);
  const done = lessons.filter((l) => l.progress?.completed).length;
  const remaining = lessons.filter((l) => !l.progress?.completed).reduce((s, l) => s + (l.durationSeconds ?? 0), 0);

  if (course.access === "GRANTED") {
    const continueId = continueLessonId(course);
    const started = course.progressPercent !== null;
    return (
      <BlueprintPanel title="学习进度">
        <div className="mt-3.5 grid grid-cols-3 gap-3">
          <BlueprintStat value={`${course.progressPercent ?? 0}%`} label="已学" />
          <BlueprintStat value={`${done}/${lessons.length}`} label="看完课时" />
          <BlueprintStat value={remaining === 0 ? 0 : Math.max(1, Math.round(remaining / 60))} label="分钟剩余" />
        </div>
        <ProgressBar value={course.progressPercent ?? 0} className="mt-3.5 bg-neutral-100" />
        <div className="mt-4">
          {continueId ? (
            <Button asChild variant="primary" size="lg" className="w-full">
              <Link to="/courses/$courseId/$lessonId" params={{ courseId: course.id, lessonId: continueId }}>
                {started ? "继续学习" : "开始学习"}
              </Link>
            </Button>
          ) : (
            <Button size="lg" disabled className="w-full">
              暂无可播课时
            </Button>
          )}
        </div>
      </BlueprintPanel>
    );
  }

  return (
    <BlueprintPanel title="开通本课">
      <div className="mt-3.5 flex items-end justify-between gap-3">
        <BlueprintStat value={formatPrice(course.priceCents)} label="一次开通，长期有效" />
        <BlueprintStat value={course.freePreviewCount} label="节可试看" />
      </div>
      <div className="my-3 h-px bg-divider" />
      <p className="text-xs text-neutral-700">
        {course.lessonCount} 课时 · {formatDuration(course.durationSeconds)}；开通后解锁全部课时，学习进度自动保存。
      </p>
      <Button variant="primary" size="lg" className="mt-4 w-full" onClick={onEnroll}>
        联系开通
      </Button>
    </BlueprintPanel>
  );
}

export function CoursePage() {
  const { courseId } = route.useParams();
  const { data: course } = useSuspenseQuery(courseQuery(courseId));
  const { data: user } = useSuspenseQuery(meQuery());
  const [enrollOpen, setEnrollOpen] = useState(false);
  const badge = accessBadge(course);
  const chapterCount = course.chapters.length + (course.unchaptered.length > 0 ? 1 : 0);

  return (
    <div className="flex min-h-full flex-col bg-bg">
      <Navbar active="courses" />

      <section className="border-b border-divider px-4 pb-7 pt-6 sm:px-8">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Link to="/courses" className="text-accent-700 hover:text-accent-900">
            网课
          </Link>
          <span className="text-neutral-600">›</span>
          <span className="truncate">{course.title}</span>
        </div>

        <header className="mt-5 grid grid-cols-1 items-start gap-6 md:grid-cols-[300px_minmax(0,1fr)] lg:grid-cols-[300px_minmax(0,1fr)_320px] lg:gap-8">
          <CourseCover course={course} className="aspect-[16/9] w-full" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Kicker className="text-accent-700">课程</Kicker>
              <Badge variant={badge.variant}>{badge.label}</Badge>
            </div>
            <h1 className="mt-2 text-balance text-[26px] leading-tight sm:text-[34px]">{course.title}</h1>
            <p className="mt-2 text-xs tabular-nums text-neutral-700">
              {course.teacher ?? "职寻教研组"} · {chapterCount} 章 · {course.lessonCount} 课时 ·{" "}
              {formatDuration(course.durationSeconds)}
            </p>
            {course.summary && <p className="mt-3 max-w-[560px] text-[15px] text-neutral-700">{course.summary}</p>}
          </div>
          <div className="md:col-span-2 lg:col-span-1">
            <CoursePanel course={course} onEnroll={() => setEnrollOpen(true)} />
          </div>
        </header>
      </section>

      <main className="grid grid-cols-1 gap-10 px-4 py-8 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <section>
          <Kicker className="mb-3 text-accent-700">课程介绍</Kicker>
          <p className="max-w-[60ch] whitespace-pre-line text-sm leading-relaxed text-neutral-700">
            {course.description ?? course.summary ?? "暂无介绍。"}
          </p>
        </section>
        <section>
          <Kicker className="mb-3 text-accent-700">章节目录</Kicker>
          <LessonList course={course} onLocked={() => setEnrollOpen(true)} />
        </section>
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
