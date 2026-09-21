import { Link } from "@tanstack/react-router";
import type { MyCourse } from "@entities/course";
import { BlueprintPanel, BlueprintStat } from "@job-hunt/ui/components/blueprint-panel";

interface StudyPanelProps {
  courses: MyCourse[];
  guest: boolean;
}

/** 学习概览：已开通 / 学习中 / 已学完，底部记住上次学到哪（`/me/courses` 已按最近学习排序） */
export function StudyPanel({ courses, guest }: StudyPanelProps) {
  const paid = courses.filter((c) => c.priceCents > 0 && c.access === "GRANTED").length;
  const learning = courses.filter((c) => c.progressPercent !== null && c.progressPercent < 100).length;
  const finished = courses.filter((c) => c.progressPercent === 100).length;
  const last = courses.find((c) => c.lastLessonId !== null) ?? null;

  return (
    <BlueprintPanel title="我的学习">
      <div className="mt-3.5 grid grid-cols-3 gap-3">
        <BlueprintStat value={paid} label="已开通" />
        <BlueprintStat value={learning} label="学习中" />
        <BlueprintStat value={finished} label="已学完" />
      </div>

      <div className="my-3 h-px bg-divider" />

      <div className="flex items-center justify-between gap-2 text-xs text-neutral-700">
        {last?.lastLessonId ? (
          <>
            <span className="truncate">上次学到：{last.lastLessonTitle ?? last.title}</span>
            <Link
              to="/courses/$courseId/$lessonId"
              params={{ courseId: last.id, lessonId: last.lastLessonId }}
              className="shrink-0 text-accent-700 hover:text-accent-900"
            >
              继续 →
            </Link>
          </>
        ) : (
          <span>{guest ? "游客的学习记录只存在本设备，登录后会合并" : "开始第一门课后，这里会记住你学到哪"}</span>
        )}
      </div>
    </BlueprintPanel>
  );
}
