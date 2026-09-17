import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { type VodCallbackBody, VodCallbackBodySchema, VodCallbackResultSchema } from "../contract";
import { prisma } from "../db";
import type { Env } from "../env";
import { AppError, validationHook } from "../lib/errors";
import { errorContent, jsonContent } from "../lib/route";
import { verifyCallbackToken } from "../lib/vod";

const callback = createRoute({
  method: "post",
  path: "/callback",
  tags: ["vod"],
  operationId: "vodCallback",
  description: "腾讯云 VOD 事件通知（无需登录，`?token=` 须等于 VOD_CALLBACK_TOKEN）；只处理 ProcedureStateChanged",
  request: {
    query: z.object({ token: z.string().optional() }),
    body: { required: true, content: { "application/json": { schema: VodCallbackBodySchema } } },
  },
  responses: {
    200: jsonContent(VodCallbackResultSchema, "已接收"),
    401: errorContent("token 无效"),
  },
});

/** 任务流结果 → 课时视频状态；PROCESSING 等中间态返回 null（忽略） */
export function procedureOutcome(event: NonNullable<VodCallbackBody["ProcedureStateChangeEvent"]>) {
  if (event.Status === "FINISH") return event.ErrCode ? "FAILED" : "READY";
  if (event.Status === "FAILED" || event.Status === "ERROR") return "FAILED";
  return null;
}

function coverFrom(event: NonNullable<VodCallbackBody["ProcedureStateChangeEvent"]>): string | null {
  for (const item of event.MediaProcessResultSet ?? []) {
    const url = item.CoverBySnapshotTask?.Output?.CoverUrl;
    if (item.Type === "CoverBySnapshot" && url) return url;
  }
  return null;
}

export const vodCallbackRoutes = new OpenAPIHono<Env>({ defaultHook: validationHook }).openapi(callback, async (c) => {
  if (!verifyCallbackToken(c.req.valid("query").token)) throw new AppError(401, "UNAUTHORIZED", "回调 token 无效");
  const body = c.req.valid("json");
  const event = body.EventType === "ProcedureStateChanged" ? body.ProcedureStateChangeEvent : null;
  const outcome = event ? procedureOutcome(event) : null;
  if (!event || !outcome) return c.json({ handled: false }, 200);
  const duration = event.MetaData?.Duration;
  const cover = coverFrom(event);
  const updated = await prisma.$transaction(async (tx) => {
    const lessons = await tx.courseLesson.findMany({
      where: { videoFileId: event.FileId },
      select: { id: true, courseId: true },
    });
    if (lessons.length === 0) return 0;
    await tx.courseLesson.updateMany({
      where: { videoFileId: event.FileId },
      data: {
        videoStatus: outcome,
        ...(outcome === "READY" && typeof duration === "number" ? { durationSeconds: Math.round(duration) } : {}),
      },
    });
    if (outcome === "READY" && cover) {
      // 封面截图回填到尚无封面的课程
      await tx.course.updateMany({
        where: { id: { in: lessons.map((l) => l.courseId) }, coverUrl: null },
        data: { coverUrl: cover },
      });
    }
    return lessons.length;
  });
  return c.json({ handled: updated > 0 }, 200);
});
