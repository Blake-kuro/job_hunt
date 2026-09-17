import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

const src = (p: string) => fileURLToPath(new URL(`./src/${p}`, import.meta.url));

/** 后端地址：.env.local 里的 VITE_API_PROXY（或环境变量），默认本机 3001 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const apiProxy = env.VITE_API_PROXY ?? process.env.VITE_API_PROXY ?? "http://localhost:3001";
  return {
    plugins: [tanstackRouter({ target: "react", autoCodeSplitting: true }), react(), tailwindcss()],
    resolve: {
      alias: {
        "@entities": src("entities"),
        "@features": src("features"),
        "@widgets": src("widgets"),
        "@views": src("views"),
        "@api": src("api"),
      },
    },
    server: {
      port: 5173,
      proxy: { "/api": { target: apiProxy, changeOrigin: true } },
    },
    preview: {
      port: 4173,
      proxy: { "/api": { target: apiProxy, changeOrigin: true } },
    },
  };
});
