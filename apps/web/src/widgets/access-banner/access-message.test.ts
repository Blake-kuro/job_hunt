import { describe, expect, it } from "vitest";
import { accessMessage } from "./access-message";

describe("accessMessage", () => {
  it("岗位：游客达到上限 → 提示登录", () => {
    const m = accessMessage({ kind: "jobs", access: { tier: "GUEST", visible: 20, total: 137 } });
    expect(m).toEqual({
      title: "未登录只能查看前 20 条岗位",
      body: "登录后可查看前 100 条，共 137 条。",
      action: { label: "登录", to: "/login" },
    });
  });
  it("刷题：游客配额用尽 → 提示登录", () => {
    const m = accessMessage({ kind: "questions", quota: { tier: "GUEST", used: 20, limit: 20 } });
    expect(m).toEqual({
      title: "未登录只能作答 20 道题",
      body: "已用完 20 道，登录后可作答 200 道。",
      action: { label: "登录", to: "/login" },
    });
  });
  it("刷题：免费用户未用尽 → null", () => {
    expect(accessMessage({ kind: "questions", quota: { tier: "FREE", used: 199, limit: 200 } })).toBeNull();
  });
  it("PRO → null", () => {
    expect(accessMessage({ kind: "questions", quota: { tier: "PRO", used: 999, limit: null } })).toBeNull();
    expect(accessMessage({ kind: "jobs", access: { tier: "PRO", visible: null, total: 999 } })).toBeNull();
  });
});
