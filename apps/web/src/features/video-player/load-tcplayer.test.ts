import { describe, expect, it, vi } from "vitest";
import { createTcPlayerLoader, TCPLAYER_CSS_URL, TCPLAYER_JS_URL } from "./load-tcplayer";
import type { TCPlayerFactory } from "./tcplayer";

const fakePlayer = (() => ({})) as unknown as TCPlayerFactory;

function setup(overrides: Partial<Parameters<typeof createTcPlayerLoader>[0]> = {}) {
  let player: TCPlayerFactory | undefined;
  const injectStyle = vi.fn(async () => {});
  const injectScript = vi.fn(async () => {
    player = fakePlayer;
  });
  const warn = vi.fn();
  const load = createTcPlayerLoader({ getPlayer: () => player, injectStyle, injectScript, warn, ...overrides });
  return { load, injectStyle, injectScript, warn, setPlayer: (p: TCPlayerFactory | undefined) => (player = p) };
}

describe("createTcPlayerLoader", () => {
  it("首次调用注入 CSS + JS，resolve 全局 TCPlayer；后续调用不再注入", async () => {
    const { load, injectStyle, injectScript } = setup();
    await expect(load()).resolves.toBe(fakePlayer);
    expect(injectStyle).toHaveBeenCalledWith(TCPLAYER_CSS_URL);
    expect(injectScript).toHaveBeenCalledWith(TCPLAYER_JS_URL);
    await expect(load()).resolves.toBe(fakePlayer);
    expect(injectStyle).toHaveBeenCalledTimes(1);
    expect(injectScript).toHaveBeenCalledTimes(1);
  });

  it("已有 window.TCPlayer 时直接 resolve，不注入", async () => {
    const { load, injectStyle, injectScript, setPlayer } = setup();
    setPlayer(fakePlayer);
    await expect(load()).resolves.toBe(fakePlayer);
    expect(injectStyle).not.toHaveBeenCalled();
    expect(injectScript).not.toHaveBeenCalled();
  });

  it("并发调用共用同一次注入", async () => {
    const { load, injectScript } = setup();
    const [a, b] = await Promise.all([load(), load()]);
    expect(a).toBe(fakePlayer);
    expect(b).toBe(fakePlayer);
    expect(injectScript).toHaveBeenCalledTimes(1);
  });

  it("脚本加载失败 → resolve null 并 warn，不抛错；再次调用会重试", async () => {
    const error = new Error("network");
    const injectScript = vi.fn().mockRejectedValueOnce(error).mockResolvedValueOnce(undefined);
    const { load, warn } = setup({ injectScript });
    await expect(load()).resolves.toBeNull();
    expect(warn).toHaveBeenCalledWith("TCPlayer 加载失败", error);
    await expect(load()).resolves.toBeNull(); // 第二次注入成功但 getPlayer 仍未定义（fake 的 injectScript 不设 player）
    expect(injectScript).toHaveBeenCalledTimes(2);
  });

  it("样式加载失败同样 → null", async () => {
    const { load } = setup({ injectStyle: vi.fn().mockRejectedValue(new Error("css")) });
    await expect(load()).resolves.toBeNull();
  });

  it("脚本加载成功但没有挂上 window.TCPlayer → null", async () => {
    const { load, warn } = setup({ injectScript: vi.fn(async () => {}) });
    await expect(load()).resolves.toBeNull();
    expect(warn).not.toHaveBeenCalled();
  });
});
