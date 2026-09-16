import { createFileRoute } from "@tanstack/react-router";
import { summaryQuery } from "@api/queries";
import { ErrorPanel } from "@shared/ui/ErrorPanel";
import { DashboardPage } from "@views/dashboard/DashboardPage";

export const Route = createFileRoute("/_admin/")({
  loader: ({ context: { queryClient } }) => queryClient.ensureQueryData(summaryQuery()),
  component: DashboardPage,
  errorComponent: ErrorPanel,
});
