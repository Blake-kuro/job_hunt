import { createFileRoute } from "@tanstack/react-router";
import { materialsQuery } from "@api/queries";
import { RouterErrorPanel } from "../-error";
import { MaterialsPage } from "@views/materials/MaterialsPage";

export const Route = createFileRoute("/_admin/materials")({
  loader: ({ context: { queryClient } }) => queryClient.ensureQueryData(materialsQuery()),
  component: MaterialsPage,
  errorComponent: RouterErrorPanel,
});
