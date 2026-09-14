import { describe, expect, it } from "vitest";
import { accessMessage } from "./access-message";

describe("accessMessage", () => {
  it("游客达到上限 → 提示登录", () => {
    const m = accessMessage({ tier: "GUEST", visible: 20, total: 137 }, "jobs");
    expect(m).toEqual({
      title: "未登录只能查看前 20 条岗位",
      body: "登录后可查看前 100 条，共 137 条。",
      action: { label: "登录", to: "/login" },
    });
  });
  it("免费用户达到上限 → 提示升级", () => {
    const m = accessMessage({ tier: "FREE", visible: 200, total: 350 }, "questions");
    expect(m).toEqual({
      title: "免费账号可练习前 200 道题",
      body: "升级 PRO 解锁全部 350 道。",
      action: { label: "了解 PRO", to: "/pro" },
    });
  });
  it("未达上限或 PRO → null", () => {
    expect(accessMessage({ tier: "GUEST", visible: 20, total: 12 }, "jobs")).toBeNull();
    expect(accessMessage({ tier: "PRO", visible: null, total: 999 }, "jobs")).toBeNull();
  });
});
