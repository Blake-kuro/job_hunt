import { describe, expect, it } from "vitest";
import { moveChapter, moveLesson, moveLessonToGroup, type Structure, toOrderBody } from "./structure";

const L = (id: string) => ({ id });
const s: Structure = {
  chapters: [
    { id: "c1", lessons: [L("a"), L("b"), L("c")] },
    { id: "c2", lessons: [L("d")] },
  ],
  unchaptered: [L("x"), L("y")],
};

describe("structure", () => {
  it("moveLesson 在章内交换相邻课时，不改动其他章与未分章，也不改原对象", () => {
    const next = moveLesson(s, "b", "up");
    expect(toOrderBody(next as Structure)).toEqual({
      chapters: [
        { id: "c1", lessonIds: ["b", "a", "c"] },
        { id: "c2", lessonIds: ["d"] },
      ],
      unchaptered: ["x", "y"],
    });
    expect(next?.chapters[1]).toBe(s.chapters[1]);
    expect(next?.unchaptered).toBe(s.unchaptered);
    expect(s.chapters[0]?.lessons.map((l) => l.id)).toEqual(["a", "b", "c"]);
    expect(moveLesson(s, "b", "down")?.chapters[0]?.lessons.map((l) => l.id)).toEqual(["a", "c", "b"]);
  });

  it("moveLesson 处理未分章课时；边缘 / 不存在 / 单课时章返回 null", () => {
    expect(moveLesson(s, "y", "up")?.unchaptered.map((l) => l.id)).toEqual(["y", "x"]);
    expect(moveLesson(s, "x", "up")).toBeNull();
    expect(moveLesson(s, "y", "down")).toBeNull();
    expect(moveLesson(s, "a", "up")).toBeNull();
    expect(moveLesson(s, "c", "down")).toBeNull();
    expect(moveLesson(s, "d", "up")).toBeNull();
    expect(moveLesson(s, "d", "down")).toBeNull();
    expect(moveLesson(s, "nope", "up")).toBeNull();
  });

  it("moveChapter 交换相邻章并保留课时；边缘 / 不存在返回 null", () => {
    const next = moveChapter(s, "c2", "up");
    expect(next?.chapters.map((c) => c.id)).toEqual(["c2", "c1"]);
    expect(next?.chapters[1]?.lessons.map((l) => l.id)).toEqual(["a", "b", "c"]);
    expect(moveChapter(s, "c1", "up")).toBeNull();
    expect(moveChapter(s, "c2", "down")).toBeNull();
    expect(moveChapter(s, "nope", "down")).toBeNull();
    expect(s.chapters.map((c) => c.id)).toEqual(["c1", "c2"]);
  });

  it("moveLessonToGroup 把课时追加到目标组末尾；同组 / 目标章不存在 / 课时不存在返回 null", () => {
    expect(toOrderBody(moveLessonToGroup(s, "a", "c2") as Structure)).toEqual({
      chapters: [
        { id: "c1", lessonIds: ["b", "c"] },
        { id: "c2", lessonIds: ["d", "a"] },
      ],
      unchaptered: ["x", "y"],
    });
    expect(toOrderBody(moveLessonToGroup(s, "x", "c1") as Structure)).toEqual({
      chapters: [
        { id: "c1", lessonIds: ["a", "b", "c", "x"] },
        { id: "c2", lessonIds: ["d"] },
      ],
      unchaptered: ["y"],
    });
    expect(moveLessonToGroup(s, "d", null)?.unchaptered.map((l) => l.id)).toEqual(["x", "y", "d"]);
    expect(moveLessonToGroup(s, "a", "c1")).toBeNull();
    expect(moveLessonToGroup(s, "x", null)).toBeNull();
    expect(moveLessonToGroup(s, "a", "nope")).toBeNull();
    expect(moveLessonToGroup(s, "nope", "c1")).toBeNull();
  });

  it("toOrderBody 覆盖全部章（含空章）与未分章课时", () => {
    expect(toOrderBody({ chapters: [{ id: "c", lessons: [] }], unchaptered: [] })).toEqual({
      chapters: [{ id: "c", lessonIds: [] }],
      unchaptered: [],
    });
  });
});
