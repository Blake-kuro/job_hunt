import { describe, expect, it } from "vitest";
import { formatDuration, formatPrice } from "./format-duration";

describe("formatDuration", () => {
  it("不足 1 分钟", () => {
    expect(formatDuration(0)).toBe("< 1 分钟");
    expect(formatDuration(59)).toBe("< 1 分钟");
    expect(formatDuration(null)).toBe("< 1 分钟");
    expect(formatDuration(-5)).toBe("< 1 分钟");
  });
  it("只有分钟", () => {
    expect(formatDuration(60)).toBe("1 分钟");
    expect(formatDuration(35 * 60 + 59)).toBe("35 分钟");
  });
  it("小时 + 分钟，整点省略分钟", () => {
    expect(formatDuration(80 * 60)).toBe("1 小时 20 分");
    expect(formatDuration(2 * 3600)).toBe("2 小时");
    expect(formatDuration(3600 * 10 + 5 * 60 + 3)).toBe("10 小时 5 分");
  });
});

describe("formatPrice", () => {
  it("免费与整数 / 小数价格", () => {
    expect(formatPrice(0)).toBe("免费");
    expect(formatPrice(19900)).toBe("¥199");
    expect(formatPrice(1990)).toBe("¥19.9");
    expect(formatPrice(5)).toBe("¥0.05");
  });
});
