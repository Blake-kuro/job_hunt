import { queryOptions } from "@tanstack/react-query";
import { client, unwrap } from "./client";
import type { JobsQuery, QuestionsQuery, StudentsQuery } from "./types";

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

export const studentsQuery = (q: StudentsQuery) =>
  queryOptions({
    queryKey: ["admin", "students", q] as const,
    queryFn: () => unwrap(client.GET("/api/admin/students", { params: { query: q } })),
  });

export const materialsQuery = () =>
  queryOptions({
    queryKey: ["admin", "materials"] as const,
    queryFn: () => unwrap(client.GET("/api/admin/materials")),
  });

export const coursesQuery = () =>
  queryOptions({
    queryKey: ["admin", "courses"] as const,
    queryFn: () => unwrap(client.GET("/api/admin/courses")),
  });

export const quizMetaQuery = () =>
  queryOptions({
    queryKey: ["admin", "quiz-meta"] as const,
    queryFn: () => unwrap(client.GET("/api/admin/quiz-meta")),
  });

export const questionsQuery = (q: QuestionsQuery) =>
  queryOptions({
    queryKey: ["admin", "questions", q] as const,
    queryFn: () => unwrap(client.GET("/api/admin/questions", { params: { query: q } })),
  });

export const jobsQuery = (q: JobsQuery) =>
  queryOptions({
    queryKey: ["admin", "jobs", q] as const,
    queryFn: () => unwrap(client.GET("/api/admin/jobs", { params: { query: q } })),
  });
