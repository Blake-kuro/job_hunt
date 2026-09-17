import type { AdminGrant } from "@job-hunt/api-client/types";
import { describe, expect, it } from "vitest";
import { fromEntity, schema, toBody } from "./grants-schema";

describe("grants-schema", () => {
  it("fromEntity 把 ISO 到期时间截成 YYYY-MM-DD，null 变成空串", () => {
    const grants: AdminGrant[] = [
      {
        id: "g1",
        contentType: "MATERIAL",
        contentId: "m1",
        contentTitle: "简历模板",
        expiresAt: "2026-12-31T00:00:00.000Z",
      },
      { id: "g2", contentType: "QUESTION", contentId: "q1", contentTitle: null, expiresAt: null },
    ];
    expect(fromEntity(grants)).toEqual({
      grants: [
        { contentType: "MATERIAL", contentId: "m1", contentTitle: "简历模板", expiresAt: "2026-12-31" },
        { contentType: "QUESTION", contentId: "q1", contentTitle: null, expiresAt: "" },
      ],
    });
  });

  it("toBody 丢弃 contentId 为空白的行，trim id，并把日期转成 UTC 零点 ISO", () => {
    const body = toBody({
      grants: [
        { contentType: "MATERIAL", contentId: "  m1  ", contentTitle: null, expiresAt: "2026-12-31" },
        { contentType: "COURSE", contentId: "   ", contentTitle: null, expiresAt: "2026-01-01" },
        { contentType: "QUESTION", contentId: "q1", contentTitle: null, expiresAt: "" },
      ],
    });
    expect(body).toEqual({
      grants: [
        { contentType: "MATERIAL", contentId: "m1", expiresAt: "2026-12-31T00:00:00.000Z" },
        { contentType: "QUESTION", contentId: "q1", expiresAt: null },
      ],
    });
  });

  it("空数组 → { grants: [] }；schema 接受空白 id 的行（交给 toBody 丢弃）", () => {
    expect(toBody({ grants: [] })).toEqual({ grants: [] });
    const r = schema.safeParse({
      grants: [{ contentType: "COURSE", contentId: " ", contentTitle: null, expiresAt: "" }],
    });
    expect(r.success).toBe(true);
    expect(
      schema.safeParse({ grants: [{ contentType: "OTHER", contentId: "x", contentTitle: null, expiresAt: "" }] })
        .success,
    ).toBe(false);
  });
});
