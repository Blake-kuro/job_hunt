import { createFileRoute } from "@tanstack/react-router";
import { summaryQuery } from "@api/queries";
import { RouterErrorPanel } from "../-error";
import { DashboardPage } from "@views/dashboard/DashboardPage";

export const Route = createFileRoute("/_admin/")({
  loader: ({ context: { queryClient } }) => queryClient.ensureQueryData(summaryQuery()),
  component: DashboardPage,
  errorComponent: RouterErrorPanel,
});
