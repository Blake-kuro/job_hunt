import { useCallback, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSaveProgress } from "@api/mutations";
import type { CourseLesson, LessonProgressBody } from "@entities/course";
import { sendProgressKeepalive, shouldMarkCompleted } from "./progress";
import type { ProgressKind } from "./VideoPlayer";

/** timeupdate 距上次上报不足这个间隔就不发 */
export const REPORT_INTERVAL_MS = 10_000;

interface ReporterState {
  position: number;
  duration: number | null;
  completed: boolean;
  lastSentAt: number;
  /** 上次上报之后位置有变化 */
  dirty: boolean;
  /** 最近一次 PUT，离开页面时把失效缓存排在它之后 */
  inflight: Promise<unknown> | null;
}

/**
 * 播放页的进度上报（节流规则见 brief）：
 * - timeupdate：距上次上报 ≥ 10 秒才发；pause / 页面隐藏：立即发；
 * - ≥ 90% 或 ended：带 completed: true 立即发（只发一次）；
 * - 关闭标签（pagehide）与离开页面（卸载）：keepalive fetch；卸载后失效 courses / my-courses。
 * 组件须按 lessonId 加 key，保证换课时时重建。
 */
export function useProgressReporter(courseId: string, lesson: CourseLesson) {
  const qc = useQueryClient();
  const save = useSaveProgress();
  const state = useRef<ReporterState>({
    position: lesson.progress?.positionSeconds ?? 0,
    duration: lesson.durationSeconds,
    completed: lesson.progress?.completed ?? false,
    // 起播时不立刻发（避免 seek 之前的 0 秒覆盖续播位置）
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
      if (!s.completed && shouldMarkCompleted(position, s.duration)) {
        s.completed = true;
        void send(true);
        return;
      }
      if (info.kind === "pause" || Date.now() - s.lastSentAt >= REPORT_INTERVAL_MS) void send();
    },
    [send],
  );

  /** ended：标记完成并等待上报完成（调用方随后跳下一课时） */
  const onEnded = useCallback(() => {
    const s = state.current;
    if (s.duration) s.position = s.duration;
    s.completed = true;
    return send(true);
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
          qc.invalidateQueries({ queryKey: ["courses"] }),
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
