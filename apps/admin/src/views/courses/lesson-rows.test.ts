import { describe, expect, it } from "vitest";
import type { AdminCourseLesson } from "@api/types";
import { fromLessons, type LessonRow, moveLesson, toCourseLessons } from "./lesson-rows";

const rows: LessonRow[] = [
  { title: "第一课", videoUrl: "https://v.example.com/1.mp4", durationMinutes: "10" },
  { title: "第二课", videoUrl: "https://v.example.com/2.mp4", durationMinutes: "" },
  { title: "第三课", videoUrl: "https://v.example.com/3.mp4", durationMinutes: "30" },
];

describe("lesson-rows", () => {
  it("moveLesson 交换相邻两行，不改原数组；越界时原样返回", () => {
    const down = moveLesson(rows, 0, "down");
    expect(down.map((r) => r.title)).toEqual(["第二课", "第一课", "第三课"]);
    expect(rows.map((r) => r.title)).toEqual(["第一课", "第二课", "第三课"]);
    expect(moveLesson(rows, 2, "up").map((r) => r.title)).toEqual(["第一课", "第三课", "第二课"]);
    expect(moveLesson(rows, 0, "up")).toBe(rows);
    expect(moveLesson(rows, 2, "down")).toBe(rows);
  });

  it("toCourseLessons 标题 / 视频链接 trim 后为空时报「第 n 课时缺少标题或视频链接」", () => {
    expect(toCourseLessons([rows[0], { ...rows[1], title: "  " }])).toEqual({
      ok: false,
      error: "第 2 课时缺少标题或视频链接",
    });
    expect(toCourseLessons([{ ...rows[0], videoUrl: "" }])).toEqual({
      ok: false,
      error: "第 1 课时缺少标题或视频链接",
    });
    expect(toCourseLessons([rows[0], { ...rows[1], videoUrl: "ftp://x" }])).toEqual({
      ok: false,
      error: "第 2 课时视频链接需以 http:// 或 https:// 开头",
    });
  });

  it("toCourseLessons trim 文本，时长空串 → null、非空 → 数字；fromLessons 反向转换", () => {
    expect(
      toCourseLessons([
        { title: " 第一课 ", videoUrl: " https://v.example.com/1.mp4 ", durationMinutes: "10" },
        rows[1],
      ]),
    ).toEqual({
      ok: true,
      lessons: [
        { title: "第一课", videoUrl: "https://v.example.com/1.mp4", durationMinutes: 10 },
        { title: "第二课", videoUrl: "https://v.example.com/2.mp4", durationMinutes: null },
      ],
    });
    const lessons: AdminCourseLesson[] = [
      { id: "l1", title: "第一课", videoUrl: "https://v.example.com/1.mp4", durationMinutes: 10, sortOrder: 0 },
      { id: "l2", title: "第二课", videoUrl: "https://v.example.com/2.mp4", durationMinutes: null, sortOrder: 1 },
    ];
    expect(fromLessons(lessons)).toEqual([
      { title: "第一课", videoUrl: "https://v.example.com/1.mp4", durationMinutes: "10" },
      { title: "第二课", videoUrl: "https://v.example.com/2.mp4", durationMinutes: "" },
    ]);
    expect(toCourseLessons([])).toEqual({ ok: true, lessons: [] });
  });
});
