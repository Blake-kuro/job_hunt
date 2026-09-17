import { useQuery } from "@tanstack/react-query";
import { ApiError } from "@job-hunt/api-client/client";
import { playInfoQuery } from "@entities/course";

export type PlayInfoBlock = "LOCKED" | "PROCESSING" | "UNAUTHORIZED" | null;

/** 把 play 接口的业务错误映射为页面状态：403 锁定、409 视频处理中、401 需登录；其余是普通错误 */
export function playInfoBlock(error: unknown): PlayInfoBlock {
  if (!(error instanceof ApiError)) return null;
  if (error.status === 403 || error.body.error.code === "FORBIDDEN") return "LOCKED";
  if (error.status === 409 || error.body.error.code === "CONFLICT") return "PROCESSING";
  if (error.status === 401 || error.body.error.code === "UNAUTHORIZED") return "UNAUTHORIZED";
  return null;
}

/**
 * 播放签名：`playInfoQuery` 在 expiresAt 前 5 分钟视为过期并静默重取；
 * 这里只在课时可播时发请求，不可播的课时由页面直接展示锁定 / 处理中面板。
 */
export function usePlayInfo(courseId: string, lessonId: string, enabled: boolean) {
  const query = useQuery({ ...playInfoQuery(courseId, lessonId), enabled });
  return { ...query, block: query.error ? playInfoBlock(query.error) : null };
}
