/**
 * 单个课时的上传状态机：idle → signing → uploading(progress) → saving → done | error(message)。
 * 纯 reducer，不含副作用；非法转移原样返回当前状态（如 idle 时收到 progress）。
 */
export type UploadState =
  | { status: "idle" }
  | { status: "signing" }
  | { status: "uploading"; progress: number }
  | { status: "saving" }
  | { status: "done" }
  | { status: "error"; message: string };

export type UploadEvent =
  | { type: "start" }
  | { type: "signed" }
  /** 0–100，越界会被截断 */
  | { type: "progress"; percent: number }
  | { type: "uploaded" }
  | { type: "saved" }
  | { type: "fail"; message: string }
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
      return state.status === "idle" ? state : { status: "error", message: event.message };
    case "reset":
      return initialUploadState;
  }
}

/** 进行中（按钮应禁用） */
export function isBusy(state: UploadState): boolean {
  return state.status === "signing" || state.status === "uploading" || state.status === "saving";
}
