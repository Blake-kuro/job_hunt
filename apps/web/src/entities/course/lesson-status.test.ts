import { describe, expect, it } from "vitest";
import { lessonPercent, lessonStatus } from "./lesson-status";

const base = {
  durationSeconds: 600,
  progress: null,
  freePreview: false,
  videoStatus: "READY",
  playable: true,
} as const;

describe("lessonPercent", () => {
  it("已完成 100、无进度 null、时长未知 null、进行中最多 99", () => {
    expect(lessonPercent(base)).toBeNull();
    expect(lessonPercent({ ...base, progress: { positionSeconds: 10, completed: true } })).toBe(100);
    expect(
      lessonPercent({ ...base, durationSeconds: null, progress: { positionSeconds: 10, completed: false } }),
    ).toBeNull();
    expect(lessonPercent({ ...base, progress: { positionSeconds: 300, completed: false } })).toBe(50);
    expect(lessonPercent({ ...base, progress: { positionSeconds: 599, completed: false } })).toBe(99);
  });
});

describe("lessonStatus", () => {
  it("优先级：已看完 > 视频状态 > 锁定 > 进度 > 试看", () => {
    expect(
      lessonStatus({ ...base, progress: { positionSeconds: 1, completed: true }, playable: false }, "LOCKED").tone,
    ).toBe("done");
    expect(lessonStatus({ ...base, videoStatus: "PROCESSING", playable: false }, "GRANTED")).toEqual({
      label: "处理中",
      tone: "pending",
    });
    expect(lessonStatus({ ...base, videoStatus: "NONE", playable: false }, "GRANTED").label).toBe("暂无视频");
    expect(lessonStatus({ ...base, playable: false }, "PREVIEW")).toEqual({ label: "需开通", tone: "locked" });
    expect(lessonStatus({ ...base, progress: { positionSeconds: 300, completed: false } }, "GRANTED")).toEqual({
      label: "50%",
      tone: "progress",
    });
    expect(lessonStatus({ ...base, freePreview: true }, "PREVIEW")).toEqual({ label: "试看", tone: "preview" });
    expect(lessonStatus({ ...base, freePreview: true }, "GRANTED").tone).toBe("none");
    expect(lessonStatus(base, "GRANTED").tone).toBe("none");
  });
});
