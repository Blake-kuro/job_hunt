import type { QueryClient } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { createRootRouteWithContext, Link, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: RootLayout,
  pendingComponent: () => (
    <p role="status" className="px-4 py-10 sm:px-8">
      正在加载…
    </p>
  ),
  notFoundComponent: () => (
    <div className="px-4 py-10 sm:px-8">
      <p>页面不存在</p>
      <Link to="/" className="text-accent-700">
        返回岗位看板
      </Link>
    </div>
  ),
});

function RootLayout() {
  return (
    <>
      <Outlet />
      {import.meta.env.DEV && (
        <>
          <TanStackRouterDevtools position="bottom-right" />
          <ReactQueryDevtools buttonPosition="bottom-left" />
        </>
      )}
    </>
  );
}
