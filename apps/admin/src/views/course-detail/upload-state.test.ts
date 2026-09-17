import { describe, expect, it } from "vitest";
import { initialUploadState, isBusy, reduce, type UploadEvent, type UploadState } from "./upload-state";

const run = (events: UploadEvent[], from: UploadState = initialUploadState) => events.reduce(reduce, from);

describe("upload-state", () => {
  it("正常路径：idle → signing → uploading → saving → done", () => {
    expect(run([{ type: "start" }])).toEqual({ status: "signing" });
    expect(run([{ type: "start" }, { type: "signed" }])).toEqual({ status: "uploading", progress: 0 });
    expect(run([{ type: "start" }, { type: "signed" }, { type: "progress", percent: 42.6 }])).toEqual({
      status: "uploading",
      progress: 43,
    });
    expect(run([{ type: "start" }, { type: "signed" }, { type: "uploaded" }])).toEqual({ status: "saving" });
    expect(run([{ type: "start" }, { type: "signed" }, { type: "uploaded" }, { type: "saved" }])).toEqual({
      status: "done",
    });
  });

  it("进度截断到 0–100，非数字当 0", () => {
    const uploading: UploadState = { status: "uploading", progress: 10 };
    expect(reduce(uploading, { type: "progress", percent: 120 })).toEqual({ status: "uploading", progress: 100 });
    expect(reduce(uploading, { type: "progress", percent: -3 })).toEqual({ status: "uploading", progress: 0 });
    expect(reduce(uploading, { type: "progress", percent: Number.NaN })).toEqual({ status: "uploading", progress: 0 });
  });

  it("非法转移不改状态：idle 收 progress / uploaded / saved / fail；signing 收 progress", () => {
    expect(reduce(initialUploadState, { type: "progress", percent: 5 })).toBe(initialUploadState);
    expect(reduce(initialUploadState, { type: "uploaded" })).toBe(initialUploadState);
    expect(reduce(initialUploadState, { type: "saved" })).toBe(initialUploadState);
    expect(reduce(initialUploadState, { type: "fail", message: "x" })).toBe(initialUploadState);
    const signing: UploadState = { status: "signing" };
    expect(reduce(signing, { type: "progress", percent: 5 })).toBe(signing);
    expect(reduce(signing, { type: "start" })).toBe(signing);
  });

  it("任一进行中状态失败 → error；error / done 可重新 start；reset 回 idle", () => {
    expect(reduce({ status: "uploading", progress: 50 }, { type: "fail", message: "网络错误" })).toEqual({
      status: "error",
      message: "网络错误",
    });
    expect(reduce({ status: "saving" }, { type: "fail", message: "保存失败" })).toEqual({
      status: "error",
      message: "保存失败",
    });
    expect(reduce({ status: "error", message: "x" }, { type: "start" })).toEqual({ status: "signing" });
    expect(reduce({ status: "done" }, { type: "start" })).toEqual({ status: "signing" });
    expect(reduce({ status: "error", message: "x" }, { type: "reset" })).toEqual(initialUploadState);
  });

  it("isBusy 只在 signing / uploading / saving 为真", () => {
    expect(isBusy({ status: "signing" })).toBe(true);
    expect(isBusy({ status: "uploading", progress: 0 })).toBe(true);
    expect(isBusy({ status: "saving" })).toBe(true);
    expect(isBusy({ status: "idle" })).toBe(false);
    expect(isBusy({ status: "done" })).toBe(false);
    expect(isBusy({ status: "error", message: "" })).toBe(false);
  });
});
