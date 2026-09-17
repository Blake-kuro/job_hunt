import { useCallback, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSaveProgress } from "@api/mutations";
import type { CourseLesson, LessonProgressBody } from "@entities/course";
import { type ProgressKind, planReport, sendProgressKeepalive } from "./progress";

interface ReporterState {
  position: number;
  duration: number | null;
  /** completed 已发出（≥ 90% 或 ended），之后不再重复带 completed */
  completedSent: boolean;
  lastSentAt: number;
  /** 上次上报之后位置有变化 */
  dirty: boolean;
  /** 最近一次 PUT，离开页面时把失效缓存排在它之后 */
  inflight: Promise<unknown> | null;
}

/**
 * 播放页的进度上报（决策见 progress.ts 的 planReport）：
 * - timeupdate：距上次上报 ≥ 10 秒才发；pause / 页面隐藏：立即发；
 * - ≥ 90% 或 ended：带 completed: true 发一次；
 * - 关闭标签（pagehide）与离开页面（卸载）：keepalive fetch；卸载后失效 课程目录 / 详情 / my-courses。
 * 组件须按 lessonId 加 key，保证换课时时重建。
 */
export function useProgressReporter(courseId: string, lesson: CourseLesson) {
  const qc = useQueryClient();
  const save = useSaveProgress();
  const state = useRef<ReporterState>({
    position: lesson.progress?.positionSeconds ?? 0,
    duration: lesson.durationSeconds,
    completedSent: lesson.progress?.completed ?? false,
    // 起播时不立刻发（timeupdate 满 10 秒后才第一次上报）
    lastSentAt: Date.now(),
    dirty: false,
    inflight: null,
  });
  const lessonId = lesson.id;

  const body = useCallback((completed: boolean): LessonProgressBody => {
    const positionSeconds = Math.max(0, Math.floor(state.current.position));
    return completed ? { positionSeconds, completed: true } : { positionSeconds };
  }, []);

  const send = useCallback(
    (completed = false) => {
      const s = state.current;
      s.lastSentAt = Date.now();
      s.dirty = false;
      if (completed) s.completedSent = true;
      s.inflight = save.mutateAsync({ courseId, lessonId, body: body(completed) }).catch(() => undefined);
      return s.inflight;
    },
    [save.mutateAsync, courseId, lessonId, body],
  );

  const onProgress = useCallback(
    (position: number, info: { kind: ProgressKind; duration: number | null }) => {
      const s = state.current;
      s.position = position;
      if (info.duration) s.duration = info.duration;
      s.dirty = true;
      const plan = planReport({
        kind: info.kind,
        now: Date.now(),
        lastSentAt: s.lastSentAt,
        position,
        duration: s.duration,
        completedSent: s.completedSent,
      });
      if (plan.send) void send(plan.completed);
    },
    [send],
  );

  /** ended：标记完成并等待上报完成（调用方随后跳下一课时）；已发过 completed 且无新位置时只等待在途请求 */
  const onEnded = useCallback(() => {
    const s = state.current;
    if (s.duration) s.position = s.duration;
    if (s.completedSent && !s.dirty) return Promise.resolve(s.inflight);
    return send(!s.completedSent);
  }, [send]);

  // 监听器 / 卸载清理只随课时变化重建；send 经 ref 取最新值，避免依赖变化误触发「离开页面」逻辑
  const sendRef = useRef(send);
  sendRef.current = send;
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden" && state.current.dirty) void sendRef.current();
    };
    const onPageHide = () => {
      if (state.current.dirty) {
        state.current.dirty = false;
        void sendProgressKeepalive(courseId, lessonId, body(false));
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      const s = state.current;
      const last = s.dirty ? sendProgressKeepalive(courseId, lessonId, body(false)) : Promise.resolve(s.inflight);
      s.dirty = false;
      void last.finally(() =>
        Promise.all([
          qc.invalidateQueries({ queryKey: ["courses", "list"] }),
          qc.invalidateQueries({ queryKey: ["courses", "detail", courseId] }),
          qc.invalidateQueries({ queryKey: ["my-courses"] }),
        ]),
      );
    };
  }, [qc, courseId, lessonId, body]);

  return {
    onProgress,
    onEnded,
    /** 当前播放位置（重建播放器时作为起播点） */
    currentPosition: () => state.current.position,
    error: save.error,
  };
}
