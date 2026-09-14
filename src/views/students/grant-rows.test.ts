import { describe, expect, it } from "vitest";
import type { AdminGrant } from "@api/types";
import { fromGrants, toAccessBody } from "./grant-rows";

describe("grant-rows", () => {
  it("fromGrants 把 ISO 到期时间截成 YYYY-MM-DD，null 变成空串", () => {
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
    expect(fromGrants(grants)).toEqual([
      { contentType: "MATERIAL", contentId: "m1", contentTitle: "简历模板", expiresAt: "2026-12-31" },
      { contentType: "QUESTION", contentId: "q1", contentTitle: null, expiresAt: "" },
    ]);
  });

  it("toAccessBody 丢弃 contentId 为空白的行，trim id，并把日期转成 UTC 零点 ISO", () => {
    const body = toAccessBody([
      { contentType: "MATERIAL", contentId: "  m1  ", contentTitle: null, expiresAt: "2026-12-31" },
      { contentType: "COURSE", contentId: "   ", contentTitle: null, expiresAt: "2026-01-01" },
      { contentType: "QUESTION", contentId: "q1", contentTitle: null, expiresAt: "" },
    ]);
    expect(body).toEqual({
      grants: [
        { contentType: "MATERIAL", contentId: "m1", expiresAt: "2026-12-31T00:00:00.000Z" },
        { contentType: "QUESTION", contentId: "q1", expiresAt: null },
      ],
    });
  });

  it("空数组 → { grants: [] }", () => {
    expect(toAccessBody([])).toEqual({ grants: [] });
  });
});
