import { describe, expect, it } from "vitest";
import { Prisma } from "../generated/prisma/client";
import { isUniqueViolation } from "./errors";

describe("isUniqueViolation", () => {
  it("只认 Prisma P2002", () => {
    const p2002 = new Prisma.PrismaClientKnownRequestError("dup", { code: "P2002", clientVersion: "7" });
    const p2025 = new Prisma.PrismaClientKnownRequestError("missing", { code: "P2025", clientVersion: "7" });
    expect(isUniqueViolation(p2002)).toBe(true);
    expect(isUniqueViolation(p2025)).toBe(false);
    expect(isUniqueViolation(new Error("P2002"))).toBe(false);
  });
});
