import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "@job-hunt/api-client/client";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // 4xx（不存在 / 未登录 / 无权限）重试没有意义，立刻把错误抛给页面的 errorComponent；
      // 只有网络类错误重试一次。注意：浏览器标签页失焦时 TanStack Query 会暂停重试，
      // 若这里对 4xx 也重试，失焦期间页面会一直停在加载态。
      retry: (failureCount, error) => !(error instanceof ApiError) && failureCount < 1,
    },
  },
});

export const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: "intent",
  scrollRestoration: true,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
