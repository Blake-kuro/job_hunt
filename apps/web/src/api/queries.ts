import { queryOptions } from "@tanstack/react-query";
import { client, unwrap } from "./client";
import type { JobListQuery } from "./types";

export const meQuery = () =>
  queryOptions({
    queryKey: ["auth", "me"] as const,
    queryFn: () => unwrap(client.GET("/api/me")),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

export const jobsQuery = (q: JobListQuery) =>
  queryOptions({
    queryKey: ["jobs", "list", q] as const,
    queryFn: () => unwrap(client.GET("/api/jobs", { params: { query: q } })),
  });

export const progressQuery = () =>
  queryOptions({ queryKey: ["jobs", "progress"] as const, queryFn: () => unwrap(client.GET("/api/jobs/progress")) });

export const quizNextQuery = (categoryId: string) =>
  queryOptions({
    staleTime: Number.POSITIVE_INFINITY,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryKey: ["quiz", "next", categoryId] as const,
    queryFn: () => unwrap(client.GET("/api/quiz/categories/{categoryId}/next", { params: { path: { categoryId } } })),
  });

export const quizDashboardQuery = () =>
  queryOptions({ queryKey: ["quiz", "dashboard"] as const, queryFn: () => unwrap(client.GET("/api/quiz/dashboard")) });

export const quizBanksQuery = () =>
  queryOptions({
    queryKey: ["quiz", "banks"] as const,
    queryFn: () => unwrap(client.GET("/api/quiz/banks")),
  });
