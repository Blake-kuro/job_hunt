/**
 * 单个课时的上传状态机：idle → signing → uploading(progress) → saving → done | error(message, fileId?)。
 * 视频已传到 VOD 但保存课时失败时，error 里带着 fileId，`retry` 只重做保存（saving），不重传。
 * 纯 reducer，不含副作用；非法转移原样返回当前状态（如 idle 时收到 progress）。
 */
export type UploadState =
  | { status: "idle" }
  | { status: "signing" }
  | { status: "uploading"; progress: number }
  | { status: "saving" }
  | { status: "done" }
  | { status: "error"; message: string; fileId?: string };

export type UploadEvent =
  | { type: "start" }
  | { type: "signed" }
  /** 0–100，越界会被截断 */
  | { type: "progress"; percent: number }
  | { type: "uploaded" }
  | { type: "saved" }
  /** fileId：VOD 已上传成功、只是保存课时失败时带上，供「重试保存」 */
  | { type: "fail"; message: string; fileId?: string }
  /** 只重做保存：仅当 error 里有 fileId */
  | { type: "retry" }
  | { type: "reset" };

export const initialUploadState: UploadState = { status: "idle" };

export function reduce(state: UploadState, event: UploadEvent): UploadState {
  switch (event.type) {
    case "start":
      return state.status === "idle" || state.status === "done" || state.status === "error"
        ? { status: "signing" }
        : state;
    case "signed":
      return state.status === "signing" ? { status: "uploading", progress: 0 } : state;
    case "progress": {
      if (state.status !== "uploading") return state;
      const p = Number.isFinite(event.percent) ? event.percent : 0;
      return { status: "uploading", progress: Math.round(Math.min(100, Math.max(0, p))) };
    }
    case "uploaded":
      return state.status === "uploading" ? { status: "saving" } : state;
    case "saved":
      return state.status === "saving" ? { status: "done" } : state;
    case "fail":
      if (state.status === "idle") return state;
      return event.fileId === undefined
        ? { status: "error", message: event.message }
        : { status: "error", message: event.message, fileId: event.fileId };
    case "retry":
      return state.status === "error" && state.fileId !== undefined ? { status: "saving" } : state;
    case "reset":
      return initialUploadState;
  }
}

/** 进行中（按钮应禁用） */
export function isBusy(state: UploadState): boolean {
  return state.status === "signing" || state.status === "uploading" || state.status === "saving";
}
