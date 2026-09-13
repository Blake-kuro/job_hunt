import { queryOptions } from "@tanstack/react-query";
import { client, unwrap } from "./client";
import type { JobListQuery } from "./types";

export const jobsQuery = (q: JobListQuery) =>
  queryOptions({
    queryKey: ["jobs", "list", q] as const,
    queryFn: () => unwrap(client.GET("/api/jobs", { params: { query: q } })),
  });

export const progressQuery = () =>
  queryOptions({ queryKey: ["jobs", "progress"] as const, queryFn: () => unwrap(client.GET("/api/jobs/progress")) });

export const quizTodayQuery = () =>
  queryOptions({
    staleTime: Number.POSITIVE_INFINITY,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryKey: ["quiz", "today"] as const,
    queryFn: () => unwrap(client.GET("/api/quiz/today")),
  });

export const quizDashboardQuery = () =>
  queryOptions({ queryKey: ["quiz", "dashboard"] as const, queryFn: () => unwrap(client.GET("/api/quiz/dashboard")) });

export const companySetsQuery = () =>
  queryOptions({
    queryKey: ["quiz", "company-sets"] as const,
    queryFn: () => unwrap(client.GET("/api/quiz/company-sets")),
  });
