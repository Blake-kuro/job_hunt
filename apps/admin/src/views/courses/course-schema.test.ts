import type { AdminCourseLesson } from "@job-hunt/api-client/types";
import { describe, expect, it } from "vitest";
import {
  defaultValues,
  type FormValues,
  fromEntity,
  fromLessons,
  type LessonRow,
  schema,
  toBody,
  toLessons,
} from "./course-schema";

const rows: LessonRow[] = [
  { title: "第一课", videoUrl: "https://v.example.com/1.mp4", durationMinutes: "10" },
  { title: "第二课", videoUrl: "https://v.example.com/2.mp4", durationMinutes: "" },
  { title: "第三课", videoUrl: "https://v.example.com/3.mp4", durationMinutes: "30" },
];

const valid: FormValues = { ...defaultValues, title: "课程", lessons: rows };

/** 校验失败时返回 [路径, 文案] 列表，成功时返回 [] */
function issues(values: FormValues): [string, string][] {
  const r = schema.safeParse(values);
  return r.success ? [] : r.error.issues.map((i) => [i.path.join("."), i.message]);
}

describe("course-schema", () => {
  it("标题必填；封面链接可空，非空需以 http:// 或 https:// 开头", () => {
    expect(issues({ ...valid, title: " " })).toEqual([["title", "请填写标题"]]);
    expect(issues({ ...valid, coverUrl: "ftp://x" })).toEqual([["coverUrl", "封面链接需以 http:// 或 https:// 开头"]]);
    expect(issues({ ...valid, coverUrl: "" })).toEqual([]);
    expect(issues({ ...valid, coverUrl: "https://img.example.com/c.png" })).toEqual([]);
  });

  it("课时标题 / 视频链接 trim 后为空时报「第 n 课时缺少标题或视频链接」，挂在该行字段上", () => {
    expect(issues({ ...valid, lessons: [rows[0], { ...rows[1], title: "  " }] })).toEqual([
      ["lessons.1.title", "第 2 课时缺少标题或视频链接"],
    ]);
    expect(issues({ ...valid, lessons: [{ ...rows[0], videoUrl: "" }] })).toEqual([
      ["lessons.0.videoUrl", "第 1 课时缺少标题或视频链接"],
    ]);
    expect(issues({ ...valid, lessons: [rows[0], { ...rows[1], videoUrl: "ftp://x" }] })).toEqual([
      ["lessons.1.videoUrl", "第 2 课时视频链接需以 http:// 或 https:// 开头"],
    ]);
  });

  it("多行同时出错时逐行报告", () => {
    expect(issues({ ...valid, lessons: [{ ...rows[0], title: "" }, rows[1], { ...rows[2], videoUrl: "x" }] })).toEqual([
      ["lessons.0.title", "第 1 课时缺少标题或视频链接"],
      ["lessons.2.videoUrl", "第 3 课时视频链接需以 http:// 或 https:// 开头"],
    ]);
  });

  it("toLessons trim 文本，时长空串 → null、非空 → 数字；fromLessons 反向转换", () => {
    expect(
      toLessons([{ title: " 第一课 ", videoUrl: " https://v.example.com/1.mp4 ", durationMinutes: "10" }, rows[1]]),
    ).toEqual([
      { title: "第一课", videoUrl: "https://v.example.com/1.mp4", durationMinutes: 10 },
      { title: "第二课", videoUrl: "https://v.example.com/2.mp4", durationMinutes: null },
    ]);
    const lessons: AdminCourseLesson[] = [
      { id: "l1", title: "第一课", videoUrl: "https://v.example.com/1.mp4", durationMinutes: 10, sortOrder: 0 },
      { id: "l2", title: "第二课", videoUrl: "https://v.example.com/2.mp4", durationMinutes: null, sortOrder: 1 },
    ];
    expect(fromLessons(lessons)).toEqual([
      { title: "第一课", videoUrl: "https://v.example.com/1.mp4", durationMinutes: "10" },
      { title: "第二课", videoUrl: "https://v.example.com/2.mp4", durationMinutes: "" },
    ]);
    expect(toLessons([])).toEqual([]);
  });

  it("toBody：描述 / 封面空 → null，带 id 即更新，课时按当前顺序发送；fromEntity 往返", () => {
    expect(toBody({ ...valid, description: " ", coverUrl: "" })).toEqual({
      type: "COURSE",
      id: undefined,
      title: "课程",
      description: null,
      coverUrl: null,
      published: false,
      lessons: toLessons(rows),
    });
    const values = fromEntity({
      id: "c1",
      title: "课程",
      description: null,
      coverUrl: null,
      published: true,
      updatedAt: "2026-09-01T00:00:00.000Z",
      lessons: [
        { id: "l1", title: "第一课", videoUrl: "https://v.example.com/1.mp4", durationMinutes: 10, sortOrder: 0 },
      ],
    });
    expect(values).toEqual({
      title: "课程",
      description: "",
      coverUrl: "",
      published: true,
      lessons: [{ title: "第一课", videoUrl: "https://v.example.com/1.mp4", durationMinutes: "10" }],
    });
    expect(toBody(values, "c1")).toMatchObject({ id: "c1", published: true, lessons: [{ durationMinutes: 10 }] });
  });
});
