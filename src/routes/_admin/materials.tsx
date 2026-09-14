import { createFileRoute } from "@tanstack/react-router";
import { materialsQuery } from "@api/queries";
import { ErrorPanel } from "@shared/ui/ErrorPanel";

export const Route = createFileRoute("/_admin/materials")({
  loader: ({ context: { queryClient } }) => queryClient.ensureQueryData(materialsQuery()),
  component: () => <h1 className="text-3xl">资料</h1>,
  errorComponent: ErrorPanel,
});
