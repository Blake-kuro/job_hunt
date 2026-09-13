import type { JobListQuery } from "@job-hunt/shared";
import { queryOptions } from "@tanstack/react-query";
import { api, unwrap } from "./client";

/** RPC 的 query 只收字符串；省略 undefined */
function toQuery(q: JobListQuery): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(q)) if (v !== undefined) out[k] = String(v);
  return out;
}

export const jobsQuery = (q: JobListQuery) =>
  queryOptions({
    queryKey: ["jobs", "list", q] as const,
    queryFn: () => unwrap(api.api.jobs.$get({ query: toQuery(q) })),
  });

export const progressQuery = () =>
  queryOptions({ queryKey: ["jobs", "progress"] as const, queryFn: () => unwrap(api.api.jobs.progress.$get()) });

export const quizTodayQuery = () =>
  queryOptions({
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryKey: ["quiz", "today"] as const,
    queryFn: () => unwrap(api.api.quiz.today.$get()),
  });

export const quizDashboardQuery = () =>
  queryOptions({ queryKey: ["quiz", "dashboard"] as const, queryFn: () => unwrap(api.api.quiz.dashboard.$get()) });

export const companySetsQuery = () =>
  queryOptions({
    queryKey: ["quiz", "company-sets"] as const,
    queryFn: () => unwrap(api.api.quiz["company-sets"].$get()),
  });
