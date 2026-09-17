/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 后端地址（Vite 开发代理目标） */
  readonly VITE_API_PROXY?: string;
  /** 腾讯云 Web 播放器 License URL（TCPlayer v5 必需） */
  readonly VITE_TCPLAYER_LICENSE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
