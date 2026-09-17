import { queryOptions } from "@tanstack/react-query";
import { client, unwrap } from "@job-hunt/api-client/client";
import type { JobListQuery } from "@job-hunt/api-client/types";

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

// 网课
export const coursesQuery = () =>
  queryOptions({ queryKey: ["courses", "list"] as const, queryFn: () => unwrap(client.GET("/api/courses")) });

export const courseQuery = (id: string) =>
  queryOptions({
    queryKey: ["courses", "detail", id] as const,
    queryFn: () => unwrap(client.GET("/api/courses/{id}", { params: { path: { id } } })),
  });

/** 签名到期前 5 分钟视为过期（staleTime）；观察者在位时到点静默重取（refetchInterval） */
const PLAY_REFRESH_AHEAD_MS = 5 * 60 * 1000;
function msUntilPlayRefresh(expiresAt: string | undefined) {
  if (!expiresAt) return 0;
  return Math.max(0, new Date(expiresAt).getTime() - Date.now() - PLAY_REFRESH_AHEAD_MS);
}

export const playInfoQuery = (courseId: string, lessonId: string) =>
  queryOptions({
    // 独立命名空间：离开播放页失效 ["courses", …] 时不会连带重取签名
    queryKey: ["play", courseId, lessonId] as const,
    queryFn: () =>
      unwrap(client.GET("/api/courses/{id}/lessons/{lessonId}/play", { params: { path: { id: courseId, lessonId } } })),
    // 403 / 409 是业务态（锁定 / 处理中），重试无意义
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: (query) => msUntilPlayRefresh(query.state.data?.expiresAt),
    refetchInterval: (query) => {
      const ms = msUntilPlayRefresh(query.state.data?.expiresAt);
      return ms > 0 ? ms : false;
    },
  });

export const myCoursesQuery = () =>
  queryOptions({ queryKey: ["my-courses"] as const, queryFn: () => unwrap(client.GET("/api/me/courses")) });
