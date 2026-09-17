import { useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, Link, useNavigate } from "@tanstack/react-router";
import { meQuery } from "@api/queries";
import { type CourseDetail, type CourseLesson, courseQuery, formatDuration } from "@entities/course";
import { flattenLessons, nextPlayableLesson } from "@features/video-player/progress";
import { usePlayInfo } from "@features/video-player/use-play-info";
import { useProgressReporter } from "@features/video-player/use-progress-reporter";
import { VideoPlayer } from "@features/video-player/VideoPlayer";
import { Button } from "@job-hunt/ui/components/button";
import { Kicker } from "@job-hunt/ui/components/kicker";
import { LessonList } from "@widgets/lesson-list/LessonList";
import { Navbar } from "@widgets/navbar/Navbar";
import { EnrollDialog } from "./EnrollDialog";

const route = getRouteApi("/courses_/$courseId_/$lessonId");

/** 播放区里的提示面板（锁定 / 处理中 / 出错） */
function Panel({ title, body, children }: { title: string; body?: string; children?: React.ReactNode }) {
  return (
    <div
      role="status"
      className="flex aspect-video w-full flex-col items-center justify-center gap-3 bg-neutral-900 px-6 text-center text-bg"
    >
      <p className="font-heading text-xl">{title}</p>
      {body && <p className="max-w-[420px] text-sm text-neutral-300">{body}</p>}
      {children && <div className="mt-1 flex flex-wrap justify-center gap-3">{children}</div>}
    </div>
  );
}

/** 自动重建播放器的上限；超过后改为手动重试 */
const MAX_AUTO_RELOADS = 2;

function LessonPlayer({
  course,
  lesson,
  guest,
  onLocked,
}: {
  course: CourseDetail;
  lesson: CourseLesson;
  guest: boolean;
  onLocked: () => void;
}) {
  const navigate = useNavigate();
  const play = usePlayInfo(course.id, lesson.id, lesson.playable);
  const reporter = useProgressReporter(course.id, lesson);
  const [playerKey, setPlayerKey] = useState(0);
  const [reloads, setReloads] = useState(0);
  const [finished, setFinished] = useState(false);
  const next = nextPlayableLesson(course, lesson.id);

  if (!lesson.playable) {
    if (lesson.videoStatus !== "READY") {
      return <Panel title="视频处理中，请稍后再试" body="讲师已上传，平台正在转码；通常几分钟内完成。" />;
    }
    return (
      <Panel title="该课时需要开通课程后观看" body="试看课时可直接播放；开通后解锁全部课时。">
        <Button variant="primary" onClick={onLocked}>
          联系开通
        </Button>
        {guest && (
          <Button asChild>
            <Link to="/login" search={{ redirect: `/courses/${course.id}/${lesson.id}` }}>
              先登录
            </Link>
          </Button>
        )}
      </Panel>
    );
  }

  if (play.isPending) return <Panel title="正在加载播放信息…" />;

  // 只有首次加载失败或业务态（锁定 / 处理中 / 需登录）才替换播放器；
  // 签名静默重取失败（isRefetchError）保留正在播放的播放器，等播放器报错再走 onExpired 重建
  const playInfo = play.data;
  if (play.isError && (play.block !== null || playInfo === undefined)) {
    if (play.block === "PROCESSING") {
      return (
        <Panel title="视频处理中，请稍后再试">
          <Button onClick={() => play.refetch()}>重试</Button>
        </Panel>
      );
    }
    if (play.block === "LOCKED") {
      return (
        <Panel title="该课时需要开通课程后观看">
          <Button variant="primary" onClick={onLocked}>
            联系开通
          </Button>
        </Panel>
      );
    }
    if (play.block === "UNAUTHORIZED") {
      return (
        <Panel title="请先登录">
          <Button asChild variant="primary">
            <Link to="/login" search={{ redirect: `/courses/${course.id}/${lesson.id}` }}>
              去登录
            </Link>
          </Button>
        </Panel>
      );
    }
    return (
      <Panel title="播放信息加载失败" body={play.error.message}>
        <Button onClick={() => play.refetch()}>重试</Button>
      </Panel>
    );
  }
  if (playInfo === undefined) return <Panel title="正在加载播放信息…" />;

  if (reloads > MAX_AUTO_RELOADS) {
    return (
      <Panel title="视频加载失败" body="可能是网络问题或播放签名失效。">
        <Button
          onClick={() => {
            setReloads(0);
            void play.refetch();
            setPlayerKey((k) => k + 1);
          }}
        >
          重新加载
        </Button>
      </Panel>
    );
  }

  const startAt =
    playerKey === 0
      ? lesson.progress?.completed && lesson.durationSeconds && playInfo.positionSeconds >= lesson.durationSeconds - 5
        ? 0
        : playInfo.positionSeconds
      : reporter.currentPosition();

  async function handleEnded() {
    await reporter.onEnded();
    if (next) {
      await navigate({ to: "/courses/$courseId/$lessonId", params: { courseId: course.id, lessonId: next.id } });
    } else {
      setFinished(true);
    }
  }

  function handleExpired() {
    // 签名失效 / 播放出错：静默重取签名并以当前位置重建播放器
    setReloads((n) => n + 1);
    void play.refetch().then(() => setPlayerKey((k) => k + 1));
  }

  return (
    <div>
      <VideoPlayer
        key={playerKey}
        playInfo={playInfo}
        startAt={startAt}
        onProgress={reporter.onProgress}
        onEnded={() => void handleEnded()}
        onExpired={handleExpired}
      />
      {finished && (
        <p role="status" className="mt-3 text-sm text-accent-700">
          已看完本课程的全部可播课时。
          <Link
            to="/courses/$courseId"
            params={{ courseId: course.id }}
            className="ml-2 underline-offset-2 hover:underline"
          >
            返回课程页
          </Link>
        </p>
      )}
      {reporter.error && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          进度保存失败：{reporter.error.message}
        </p>
      )}
    </div>
  );
}

export function PlayerPage() {
  const { courseId, lessonId } = route.useParams();
  const { data: course } = useSuspenseQuery(courseQuery(courseId));
  const { data: user } = useSuspenseQuery(meQuery());
  const [enrollOpen, setEnrollOpen] = useState(false);
  const lessons = flattenLessons(course);
  const lesson = lessons.find((l) => l.id === lessonId) ?? null;
  const index = lesson ? lessons.indexOf(lesson) + 1 : 0;

  return (
    <div className="flex min-h-full flex-col bg-bg">
      <Navbar active="courses" />
      <div className="flex flex-wrap items-center gap-2 border-b border-divider px-4 py-3 text-sm sm:px-8">
        <Link to="/courses" className="text-accent-700 hover:text-accent-900">
          网课
        </Link>
        <span className="text-neutral-600">›</span>
        <Link to="/courses/$courseId" params={{ courseId }} className="truncate text-accent-700 hover:text-accent-900">
          {course.title}
        </Link>
        {lesson && (
          <>
            <span className="text-neutral-600">›</span>
            <span className="truncate">{lesson.title}</span>
          </>
        )}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px]">
        <main className="px-4 py-6 sm:px-8">
          {lesson ? (
            <>
              <LessonPlayer
                key={lesson.id}
                course={course}
                lesson={lesson}
                guest={user.tier === "GUEST"}
                onLocked={() => setEnrollOpen(true)}
              />
              <div className="mt-5">
                <Kicker className="text-accent-700">
                  第 {index} / {lessons.length} 课时
                  {lesson.durationSeconds ? ` · ${formatDuration(lesson.durationSeconds)}` : ""}
                </Kicker>
                <h1 className="mt-2 text-[24px] leading-tight sm:text-[30px]">{lesson.title}</h1>
                {(course.description ?? course.summary) && (
                  <p className="mt-3 max-w-[760px] whitespace-pre-line text-sm leading-relaxed text-neutral-700">
                    {course.description ?? course.summary}
                  </p>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-start gap-3 py-6">
              <p className="font-heading text-xl">课时不存在</p>
              <p className="text-sm text-neutral-700">可能已被讲师移除，请回到课程页选择其他课时。</p>
              <Button asChild>
                <Link to="/courses/$courseId" params={{ courseId }}>
                  返回课程页
                </Link>
              </Button>
            </div>
          )}
        </main>
        <aside className="border-t border-divider lg:border-l lg:border-t-0">
          <div className="px-4 pb-6 pt-5 sm:px-6 lg:px-3">
            <Kicker className="mb-3 px-3 text-accent-700">课时目录</Kicker>
            <LessonList course={course} currentId={lessonId} compact onLocked={() => setEnrollOpen(true)} />
          </div>
        </aside>
      </div>
      <EnrollDialog
        open={enrollOpen}
        onClose={() => setEnrollOpen(false)}
        courseTitle={course.title}
        priceCents={course.priceCents}
        guest={user.tier === "GUEST"}
        redirectTo={`/courses/${courseId}/${lessonId}`}
      />
    </div>
  );
}
