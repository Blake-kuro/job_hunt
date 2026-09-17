import { describe, expect, it } from "vitest";
import type { CourseLesson } from "@entities/course";
import { continueLessonId, flattenLessons, nextPlayableLesson, progressUrl, shouldMarkCompleted } from "./progress";

function lesson(id: string, patch: Partial<CourseLesson> = {}): CourseLesson {
  return {
    id,
    title: id,
    durationSeconds: 600,
    freePreview: false,
    videoStatus: "READY",
    playable: true,
    progress: null,
    ...patch,
  };
}

const detail = {
  chapters: [
    { id: "c1", title: "一", lessons: [lesson("l1"), lesson("l2", { playable: false })] },
    { id: "c2", title: "二", lessons: [lesson("l3")] },
  ],
  unchaptered: [lesson("l4", { playable: false, videoStatus: "PROCESSING" }), lesson("l5")],
  lastLessonId: null as string | null,
};

describe("shouldMarkCompleted", () => {
  it("≥ 90% 算看完", () => {
    expect(shouldMarkCompleted(540, 600)).toBe(true);
    expect(shouldMarkCompleted(539, 600)).toBe(false);
  });
  it("时长未知时只有 ended 才算", () => {
    expect(shouldMarkCompleted(10_000, null)).toBe(false);
    expect(shouldMarkCompleted(10_000, 0)).toBe(false);
    expect(shouldMarkCompleted(10_000, null, true)).toBe(true);
    expect(shouldMarkCompleted(1, 600, true)).toBe(true);
  });
});

describe("flattenLessons / nextPlayableLesson", () => {
  it("章内顺序展开，未分章排最后", () => {
    expect(flattenLessons(detail).map((l) => l.id)).toEqual(["l1", "l2", "l3", "l4", "l5"]);
  });
  it("跳过不可播课时找下一课", () => {
    expect(nextPlayableLesson(detail, "l1")?.id).toBe("l3");
    expect(nextPlayableLesson(detail, "l3")?.id).toBe("l5");
    expect(nextPlayableLesson(detail, "l5")).toBeNull();
  });
  it("currentId 不存在时从头找", () => {
    expect(nextPlayableLesson(detail, "nope")?.id).toBe("l1");
  });
});

describe("continueLessonId", () => {
  it("优先上次学到的可播课时，否则第一个可播", () => {
    expect(continueLessonId({ ...detail, lastLessonId: "l3" })).toBe("l3");
    expect(continueLessonId({ ...detail, lastLessonId: "l2" })).toBe("l1");
    expect(continueLessonId(detail)).toBe("l1");
    expect(
      continueLessonId({ chapters: [], unchaptered: [lesson("x", { playable: false })], lastLessonId: null }),
    ).toBeNull();
  });
});

describe("progressUrl", () => {
  it("拼接并转义路径参数", () => {
    expect(progressUrl("course-1", "lesson/2")).toBe("/api/courses/course-1/lessons/lesson%2F2/progress");
  });
});
