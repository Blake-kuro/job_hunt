import { useEffect, useId, useRef } from "react";
import type { PlayInfo } from "@entities/course";
import type { TCPlayerInstance } from "./tcplayer";

export type ProgressKind = "timeupdate" | "pause";

export interface VideoPlayerProps {
  playInfo: PlayInfo;
  /** 起播位置（秒） */
  startAt: number;
  /** 每次 timeupdate / pause 都会调用（不节流，节流由页面做）；duration 未知时为 null */
  onProgress: (position: number, info: { kind: ProgressKind; duration: number | null }) => void;
  onEnded: () => void;
  /** 播放器报错（多为签名过期 / 防盗链失效）：页面应重取签名并以当前位置重建播放器 */
  onExpired: () => void;
}

/** 验收用：没有 TCPlayer 脚本（离线 / CDN 被拦）或后端 VOD_MOCK 签名时，播本地 public/sample.mp4（不入库） */
const MOCK_PSIGN = "mock-play";
const MOCK_SRC = "/sample.mp4";

function useMock(psign: string) {
  return typeof window === "undefined" || typeof window.TCPlayer !== "function" || psign === MOCK_PSIGN;
}

function safeDuration(value: number): number | null {
  return Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * tcplayer 封装：以 useRef 持有实例，卸载时 dispose。
 * 只在 fileId 变化时重建（签名静默续期不打断播放）；签名失效导致的播放错误经 onExpired 交给页面重建。
 */
export function VideoPlayer({ playInfo, startAt, onProgress, onEnded, onExpired }: VideoPlayerProps) {
  const mock = useMock(playInfo.psign);
  const elementId = `tcplayer-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<TCPlayerInstance | null>(null);
  const callbacks = useRef({ onProgress, onEnded, onExpired });
  callbacks.current = { onProgress, onEnded, onExpired };
  const info = useRef(playInfo);
  info.current = playInfo;
  const startAtRef = useRef(startAt);
  const { fileId } = playInfo;

  // 真实播放器：<video> 由这里手动创建 —— tcplayer 会用自己的容器包住并在 dispose 时移除它，
  // 若交给 React 渲染，卸载时 React 会因节点已不在而报错
  useEffect(() => {
    const container = containerRef.current;
    if (mock || !window.TCPlayer || !container) return;
    const video = document.createElement("video");
    video.id = elementId;
    video.preload = "auto";
    video.setAttribute("playsinline", "");
    video.setAttribute("webkit-playsinline", "");
    video.className = "size-full";
    container.replaceChildren(video);
    const player = window.TCPlayer(elementId, {
      fileID: fileId,
      appID: info.current.appId,
      psign: info.current.psign,
      autoplay: true,
      language: "zh-cn",
    });
    playerRef.current = player;
    const start = startAtRef.current;
    player.ready(() => {
      if (start > 0) player.currentTime(start);
    });
    player.on("timeupdate", () =>
      callbacks.current.onProgress(player.currentTime(), {
        kind: "timeupdate",
        duration: safeDuration(player.duration()),
      }),
    );
    player.on("pause", () =>
      callbacks.current.onProgress(player.currentTime(), { kind: "pause", duration: safeDuration(player.duration()) }),
    );
    player.on("ended", () => callbacks.current.onEnded());
    player.on("error", () => callbacks.current.onExpired());
    return () => {
      playerRef.current = null;
      try {
        player.dispose();
      } catch {
        // 播放器已被销毁（例如 DOM 先被移除）时忽略
      }
      container.replaceChildren();
    };
  }, [mock, elementId, fileId]);

  // mock：原生 <video>，事件与真实分支一致
  useEffect(() => {
    if (!mock) return;
    const video = videoRef.current;
    if (!video) return;
    const start = startAtRef.current;
    const seek = () => {
      if (start > 0 && start < video.duration) video.currentTime = start;
    };
    if (video.readyState >= 1) seek();
    const onMeta = () => seek();
    const onTime = () =>
      callbacks.current.onProgress(video.currentTime, { kind: "timeupdate", duration: safeDuration(video.duration) });
    const onPause = () => {
      // ended 也会触发 pause；结束由 onEnded 处理
      if (video.ended) return;
      callbacks.current.onProgress(video.currentTime, { kind: "pause", duration: safeDuration(video.duration) });
    };
    const onEnd = () => callbacks.current.onEnded();
    const onError = () => callbacks.current.onExpired();
    video.addEventListener("loadedmetadata", onMeta);
    video.addEventListener("timeupdate", onTime);
    video.addEventListener("pause", onPause);
    video.addEventListener("ended", onEnd);
    video.addEventListener("error", onError);
    return () => {
      video.removeEventListener("loadedmetadata", onMeta);
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("ended", onEnd);
      video.removeEventListener("error", onError);
    };
  }, [mock]);

  if (mock) {
    return (
      <div className="aspect-video w-full bg-neutral-900">
        {/* 验收用：public/sample.mp4 不入库（见 .gitignore） */}
        <video
          ref={videoRef}
          controls
          playsInline
          src={MOCK_SRC}
          className="size-full"
          aria-label="课程视频（本地示例）"
        >
          <track kind="captions" />
        </video>
      </div>
    );
  }

  return <div ref={containerRef} className="aspect-video w-full bg-neutral-900" />;
}
