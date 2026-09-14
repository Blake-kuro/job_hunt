import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { meQuery } from "@api/queries";
import { AdminErrorPanel } from "@shared/ui/AuthErrorPanel";
import { Sidebar } from "@widgets/sidebar/Sidebar";

export const Route = createFileRoute("/_admin")({
  beforeLoad: async ({ context: { queryClient } }) => {
    const me = await queryClient.fetchQuery(meQuery());
    if (me.role !== "ADMIN") {
      throw redirect({ to: "/login", search: { reason: me.tier === "GUEST" ? undefined : "forbidden" } });
    }
    return { me };
  },
  component: AdminLayout,
  errorComponent: AdminErrorPanel,
});

function AdminLayout() {
  const { me } = Route.useRouteContext();
  return (
    <div className="flex min-h-full">
      <Sidebar me={me} />
      <main className="min-w-0 flex-1 px-6 py-8 lg:px-10">
        <Outlet />
      </main>
    </div>
  );
}
