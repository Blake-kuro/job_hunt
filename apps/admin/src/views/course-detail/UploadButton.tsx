import type { AdminLesson } from "@job-hunt/api-client/types";
import { Button } from "@job-hunt/ui/components/button";
import { useReducer, useRef } from "react";
import TcVod from "vod-js-sdk-v6";
import { useCreateUploadSignature, usePatchLesson, useRefreshLessonVideo } from "@api/mutations";
import { initialUploadState, isBusy, reduce, type UploadState } from "./upload-state";

/** 后端 mock 模式（VOD_MOCK=1）返回的固定签名：不走 SDK，直接写一个假 fileId */
const MOCK_SIGNATURE = "mock-upload";

/** SDK 的 media_progress 事件负载（percent 为 0–1） */
interface MediaProgress {
  percent: number;
}

const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));

/**
 * 上传流程：取签名 → （真实）`new TcVod({ getSignature })` 直传，监听 media_progress → done 拿 fileId
 * → PATCH 课时 videoFileId（后端置 PROCESSING）→ 立即刷新一次状态（mock 下直接 READY；真实环境多半仍 PROCESSING，需稍后手动刷新）。
 * 视频已到 VOD 但保存失败时 fileId 留在 error 状态里，`retrySave` 只重做保存，不重传。
 */
export function useLessonUpload(lesson: AdminLesson, courseId: string) {
  const [state, dispatch] = useReducer(reduce, initialUploadState);
  const sign = useCreateUploadSignature();
  const patch = usePatchLesson();
  const refresh = useRefreshLessonVideo();

  /** 保存阶段：PATCH videoFileId + 刷新一次；失败把 fileId 带进 error */
  async function save(fileId: string) {
    try {
      await patch.mutateAsync({ id: lesson.id, courseId, body: { videoFileId: fileId } });
      await refresh.mutateAsync({ id: lesson.id, courseId });
      dispatch({ type: "saved" });
    } catch (e) {
      dispatch({ type: "fail", message: `视频已上传（${fileId}），保存课时失败：${errorMessage(e)}`, fileId });
    }
  }

  async function upload(file: File) {
    dispatch({ type: "start" });
    let fileId: string;
    try {
      const { signature } = await sign.mutateAsync();
      dispatch({ type: "signed" });
      if (signature === MOCK_SIGNATURE) {
        // mock 环境：后端不会真去腾讯云，随便一个 fileId 即可；fetchMediaInfo 会返回 READY / 600 秒
        fileId = `mock-${Date.now()}`;
        dispatch({ type: "progress", percent: 100 });
      } else {
        const tcVod = new TcVod({ getSignature: async () => (await sign.mutateAsync()).signature });
        const uploader = tcVod.upload({ mediaFile: file });
        uploader.on("media_progress", (info: MediaProgress) =>
          dispatch({ type: "progress", percent: info.percent * 100 }),
        );
        const result = (await uploader.done()) as { fileId: string };
        fileId = result.fileId;
      }
    } catch (e) {
      dispatch({ type: "fail", message: `上传失败：${errorMessage(e)}` });
      return;
    }
    dispatch({ type: "uploaded" });
    await save(fileId);
  }

  /** 只重做保存（仅 error 且带 fileId 时有效） */
  async function retrySave() {
    if (state.status !== "error" || state.fileId === undefined) return;
    dispatch({ type: "retry" });
    await save(state.fileId);
  }

  return { state, upload, retrySave, reset: () => dispatch({ type: "reset" }) };
}

interface UploadButtonProps {
  state: UploadState;
  hasVideo: boolean;
  disabled?: boolean;
  onFile: (file: File) => void;
}

/** 隐藏的 <input type="file">，按钮触发选择；同一文件再次选择也能触发（每次选完清空 value） */
export function UploadButton({ state, hasVideo, disabled, onFile }: UploadButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const busy = isBusy(state);
  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) onFile(file);
        }}
      />
      <Button size="sm" disabled={disabled || busy} onClick={() => inputRef.current?.click()}>
        {busy ? "上传中…" : hasVideo ? "重新上传" : "上传视频"}
      </Button>
    </>
  );
}
