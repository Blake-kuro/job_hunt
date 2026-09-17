import type { TCPlayerFactory } from "./tcplayer";

/**
 * 按需加载腾讯云播放器 TCPlayer v5（CSS + JS，CDN）。
 * 只在播放页真正需要真实播放器时调用，避免 index.html 全局引入阻塞其他页面首屏。
 * 「注入」抽成可注入依赖，纯逻辑（去重 / 缓存 / 失败 → null）可在无 DOM 环境下测试。
 */
export const TCPLAYER_VERSION = "5.3.3";
export const TCPLAYER_CSS_URL = `https://web.sdk.qcloud.com/player/tcplayer/release/v${TCPLAYER_VERSION}/tcplayer.min.css`;
export const TCPLAYER_JS_URL = `https://web.sdk.qcloud.com/player/tcplayer/release/v${TCPLAYER_VERSION}/tcplayer.v${TCPLAYER_VERSION}.min.js`;

export interface TcPlayerLoaderDeps {
  /** 读取全局 `window.TCPlayer`；未定义即尚未加载 */
  getPlayer: () => TCPlayerFactory | undefined;
  /** 注入 `<link rel="stylesheet">`，加载失败 reject */
  injectStyle: (url: string) => Promise<void>;
  /** 注入 `<script>`，加载失败 reject */
  injectScript: (url: string) => Promise<void>;
  /** 加载失败时的日志 */
  warn?: (message: string, error: unknown) => void;
}

export type LoadTcPlayer = () => Promise<TCPlayerFactory | null>;

/**
 * 创建加载器：首次调用注入 CSS + JS 并缓存 Promise，并发调用共用一次注入；
 * 任一资源失败或脚本执行后仍无 `window.TCPlayer` → resolve null，并清掉缓存，下次调用可重试。
 */
export function createTcPlayerLoader(deps: TcPlayerLoaderDeps): LoadTcPlayer {
  let pending: Promise<TCPlayerFactory | null> | null = null;
  return () => {
    const existing = deps.getPlayer();
    if (existing) return Promise.resolve(existing);
    if (pending) return pending;
    pending = Promise.all([deps.injectStyle(TCPLAYER_CSS_URL), deps.injectScript(TCPLAYER_JS_URL)])
      .then(() => deps.getPlayer() ?? null)
      .catch((error: unknown) => {
        deps.warn?.("TCPlayer 加载失败", error);
        return null;
      })
      .then((player) => {
        if (!player) pending = null;
        return player;
      });
    return pending;
  };
}

function injectOnce(selector: string, create: () => HTMLLinkElement | HTMLScriptElement): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.head.querySelector<HTMLElement>(selector);
    if (existing?.dataset.loaded === "1") return resolve();
    const element = existing ?? create();
    element.addEventListener("load", () => {
      element.dataset.loaded = "1";
      resolve();
    });
    element.addEventListener("error", () => {
      element.remove();
      reject(new Error(`加载失败：${selector}`));
    });
    if (!existing) document.head.appendChild(element);
  });
}

const browserDeps: TcPlayerLoaderDeps = {
  getPlayer: () => (typeof window === "undefined" ? undefined : window.TCPlayer),
  injectStyle: (url) =>
    injectOnce(`link[href="${url}"]`, () => {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = url;
      return link;
    }),
  injectScript: (url) =>
    injectOnce(`script[src="${url}"]`, () => {
      const script = document.createElement("script");
      script.src = url;
      script.async = true;
      return script;
    }),
  warn: (message, error) => console.warn(message, error),
};

/** 播放页用：resolve `window.TCPlayer`，加载失败 resolve null（页面显示「播放器加载失败」而不是退回示例视频） */
export const loadTcPlayer: LoadTcPlayer = createTcPlayerLoader(browserDeps);
