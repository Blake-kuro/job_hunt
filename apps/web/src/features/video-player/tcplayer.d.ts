/**
 * 腾讯云播放器 TCPlayer v5 的最小类型声明（脚本由 index.html 从 CDN 引入，挂在 window.TCPlayer）。
 * 只声明本项目用到的 API；完整文档：https://cloud.tencent.com/document/product/266/58772
 */
export interface TCPlayerOptions {
  fileID: string;
  appID: string;
  psign?: string;
  autoplay?: boolean;
  /** 起播时间（秒） */
  startTime?: number;
  language?: "zh-cn" | "en";
}

export interface TCPlayerInstance {
  on(event: string, handler: (event?: unknown) => void): void;
  off(event: string, handler?: (event?: unknown) => void): void;
  ready(callback: () => void): void;
  currentTime(): number;
  currentTime(seconds: number): void;
  duration(): number;
  paused(): boolean;
  dispose(): void;
}

declare global {
  interface Window {
    /** 第一个参数是页面里 `<video>` 元素的 id */
    TCPlayer?: (elementId: string, options: TCPlayerOptions) => TCPlayerInstance;
  }
}
