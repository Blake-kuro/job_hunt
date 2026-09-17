/**
 * 腾讯云播放器 TCPlayer v5 的最小类型声明（脚本由 `load-tcplayer.ts` 在播放页按需从 CDN 注入，挂在 window.TCPlayer）。
 * 只声明本项目用到的 API；完整文档：https://cloud.tencent.com/document/product/266/58772
 */
export interface TCPlayerOptions {
  fileID: string;
  appID: string;
  psign?: string;
  /** Web 播放 License URL（控制台「播放器 SDK → License 管理」申请）；v5 必填，缺失时初始化报错不出画面 */
  licenseUrl?: string;
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

/** 第一个参数是页面里 `<video>` 元素的 id */
export type TCPlayerFactory = (elementId: string, options: TCPlayerOptions) => TCPlayerInstance;

declare global {
  interface Window {
    TCPlayer?: TCPlayerFactory;
  }
}
