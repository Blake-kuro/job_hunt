import { queryOptions } from "@tanstack/react-query";
import { client, unwrap } from "@job-hunt/api-client/client";
import type { CoursesQuery, JobsQuery, QuestionsQuery, StudentsQuery } from "@job-hunt/api-client/types";

/** URL 里的布尔过滤（?enabled=false）→ 后端 query 的 "true" | "false" */
const boolParam = (v: boolean | undefined) =>
  v === undefined ? undefined : v ? ("true" as const) : ("false" as const);
export type StudentsSearch = Omit<StudentsQuery, "enabled"> & { enabled?: boolean };
export type QuestionsSearch = Omit<QuestionsQuery, "published"> & { published?: boolean };
export type CoursesSearch = Omit<CoursesQuery, "published"> & { published?: boolean };

export const meQuery = () =>
  queryOptions({
    queryKey: ["auth", "me"] as const,
    queryFn: () => unwrap(client.GET("/api/me")),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

export const summaryQuery = () =>
  queryOptions({
    queryKey: ["admin", "summary"] as const,
    queryFn: () => unwrap(client.GET("/api/admin/summary")),
  });

export const studentsQuery = (s: StudentsSearch) => {
  const q: StudentsQuery = { ...s, enabled: boolParam(s.enabled) };
  return queryOptions({
    queryKey: ["admin", "students", q] as const,
    queryFn: () => unwrap(client.GET("/api/admin/students", { params: { query: q } })),
  });
};

export const materialsQuery = () =>
  queryOptions({
    queryKey: ["admin", "materials"] as const,
    queryFn: () => unwrap(client.GET("/api/admin/materials")),
  });

/** 课程分页列表；key 前缀 ["admin", "courses"] 由写操作整体失效 */
export const adminCoursesQuery = (s: CoursesSearch = {}) => {
  const q: CoursesQuery = { ...s, published: boolParam(s.published) };
  return queryOptions({
    queryKey: ["admin", "courses", q] as const,
    queryFn: () => unwrap(client.GET("/api/admin/courses", { params: { query: q } })),
  });
};

/** 课程详情（含章 / 课时全量）；key 前缀 ["admin", "course", id] 覆盖详情与学员列表 */
export const adminCourseQuery = (id: string) =>
  queryOptions({
    queryKey: ["admin", "course", id] as const,
    queryFn: () => unwrap(client.GET("/api/admin/courses/{id}", { params: { path: { id } } })),
  });

export const adminCourseStudentsQuery = (id: string, page: number) =>
  queryOptions({
    queryKey: ["admin", "course", id, "students", page] as const,
    queryFn: () =>
      unwrap(client.GET("/api/admin/courses/{id}/students", { params: { path: { id }, query: { page } } })),
  });

export const quizMetaQuery = () =>
  queryOptions({
    queryKey: ["admin", "quiz-meta"] as const,
    queryFn: () => unwrap(client.GET("/api/admin/quiz-meta")),
  });

export const questionsQuery = (s: QuestionsSearch) => {
  const q: QuestionsQuery = { ...s, published: boolParam(s.published) };
  return queryOptions({
    queryKey: ["admin", "questions", q] as const,
    queryFn: () => unwrap(client.GET("/api/admin/questions", { params: { query: q } })),
  });
};

export const jobsQuery = (q: JobsQuery) =>
  queryOptions({
    queryKey: ["admin", "jobs", q] as const,
    queryFn: () => unwrap(client.GET("/api/admin/jobs", { params: { query: q } })),
  });
