import { beforeEach, describe, expect, it } from "vitest";
import app from "../app";
import { prisma } from "../db";
import { MOCK_CALLBACK_TOKEN } from "../lib/vod";
import { hasDb, resetDb } from "../test/db";
import { jsonInit } from "../test/http";
import { procedureOutcome } from "./vod-callback";

const event = (FileId: string, Status: string, extra: Record<string, unknown> = {}) => ({
  EventType: "ProcedureStateChanged",
  ProcedureStateChangeEvent: { FileId, Status, ErrCode: 0, Message: "", ...extra },
});

describe("procedureOutcome", () => {
  it("FINISH → READY；FINISH 带 ErrCode → FAILED；PROCESSING → 忽略", () => {
    expect(procedureOutcome({ FileId: "f", Status: "FINISH" })).toBe("READY");
    expect(procedureOutcome({ FileId: "f", Status: "FINISH", ErrCode: 1001 })).toBe("FAILED");
    expect(procedureOutcome({ FileId: "f", Status: "FAILED" })).toBe("FAILED");
    expect(procedureOutcome({ FileId: "f", Status: "PROCESSING" })).toBeNull();
  });
});

describe.skipIf(!hasDb)("POST /api/vod/callback", () => {
  const url = `/api/vod/callback?token=${MOCK_CALLBACK_TOKEN}`;

  beforeEach(async () => {
    await resetDb();
    await prisma.course.create({
      data: {
        id: "c1",
        title: "课",
        published: true,
        lessons: {
          create: [
            { id: "l1", title: "一", videoFileId: "file-1", videoStatus: "PROCESSING" },
            { id: "l2", title: "二", videoFileId: "file-2", videoStatus: "PROCESSING" },
          ],
        },
      },
    });
  });

  it("token 缺失或错误 → 401，不改数据", async () => {
    expect((await app.request("/api/vod/callback", jsonInit("POST", event("file-1", "FINISH")))).status).toBe(401);
    const wrong = await app.request("/api/vod/callback?token=nope", jsonInit("POST", event("file-1", "FINISH")));
    expect(wrong.status).toBe(401);
    expect(await wrong.json()).toMatchObject({ error: { code: "UNAUTHORIZED" } });
    expect((await prisma.courseLesson.findUniqueOrThrow({ where: { id: "l1" } })).videoStatus).toBe("PROCESSING");
  });

  it("FINISH → READY，回填时长与封面（封面只填尚无封面的课程）", async () => {
    const res = await app.request(
      url,
      jsonInit(
        "POST",
        event("file-1", "FINISH", {
          MetaData: { Duration: 123.6, Size: 1 },
          MediaProcessResultSet: [
            { Type: "Transcode", TranscodeTask: { Status: "SUCCESS" } },
            {
              Type: "CoverBySnapshot",
              CoverBySnapshotTask: { Status: "SUCCESS", Output: { CoverUrl: "https://cdn/cover.jpg" } },
            },
          ],
        }),
      ),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ handled: true });
    expect(await prisma.courseLesson.findUniqueOrThrow({ where: { id: "l1" } })).toMatchObject({
      videoStatus: "READY",
      durationSeconds: 124,
    });
    expect((await prisma.courseLesson.findUniqueOrThrow({ where: { id: "l2" } })).videoStatus).toBe("PROCESSING");
    expect((await prisma.course.findUniqueOrThrow({ where: { id: "c1" } })).coverUrl).toBe("https://cdn/cover.jpg");

    await app.request(
      url,
      jsonInit(
        "POST",
        event("file-2", "FINISH", {
          MediaProcessResultSet: [
            { Type: "CoverBySnapshot", CoverBySnapshotTask: { Output: { CoverUrl: "https://cdn/other.jpg" } } },
          ],
        }),
      ),
    );
    expect((await prisma.course.findUniqueOrThrow({ where: { id: "c1" } })).coverUrl).toBe("https://cdn/cover.jpg");
  });

  it("失败 → FAILED；PROCESSING / 其他事件 / 未知 fileId → handled=false 且不改数据", async () => {
    expect(
      await (await app.request(url, jsonInit("POST", event("file-1", "FINISH", { ErrCode: 1001 })))).json(),
    ).toEqual({ handled: true });
    expect((await prisma.courseLesson.findUniqueOrThrow({ where: { id: "l1" } })).videoStatus).toBe("FAILED");

    expect(await (await app.request(url, jsonInit("POST", event("file-2", "PROCESSING")))).json()).toEqual({
      handled: false,
    });
    expect(
      await (
        await app.request(url, jsonInit("POST", { EventType: "NewFileUpload", FileUploadEvent: { FileId: "file-2" } }))
      ).json(),
    ).toEqual({ handled: false });
    expect(await (await app.request(url, jsonInit("POST", event("unknown", "FINISH")))).json()).toEqual({
      handled: false,
    });
    expect((await prisma.courseLesson.findUniqueOrThrow({ where: { id: "l2" } })).videoStatus).toBe("PROCESSING");
  });
});
