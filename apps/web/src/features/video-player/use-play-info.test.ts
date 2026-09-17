import { describe, expect, it } from "vitest";
import { ApiError } from "@job-hunt/api-client/client";
import { playInfoBlock } from "./use-play-info";

const err = (status: number, code: "FORBIDDEN" | "CONFLICT" | "UNAUTHORIZED" | "INTERNAL") =>
  new ApiError(status, { error: { code, message: "x" } });

describe("playInfoBlock", () => {
  it("403 锁定、409 处理中、401 需登录，其余不是业务态", () => {
    expect(playInfoBlock(err(403, "FORBIDDEN"))).toBe("LOCKED");
    expect(playInfoBlock(err(409, "CONFLICT"))).toBe("PROCESSING");
    expect(playInfoBlock(err(401, "UNAUTHORIZED"))).toBe("UNAUTHORIZED");
    expect(playInfoBlock(err(500, "INTERNAL"))).toBeNull();
    expect(playInfoBlock(new Error("network"))).toBeNull();
  });
});
