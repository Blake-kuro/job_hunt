import { createFileRoute } from "@tanstack/react-router";
import { materialsQuery } from "@api/queries";
import { ErrorPanel } from "@shared/ui/ErrorPanel";
import { MaterialsPage } from "@views/materials/MaterialsPage";

export const Route = createFileRoute("/_admin/materials")({
  loader: ({ context: { queryClient } }) => queryClient.ensureQueryData(materialsQuery()),
  component: MaterialsPage,
  errorComponent: ErrorPanel,
});
