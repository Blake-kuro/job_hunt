import { createFileRoute } from "@tanstack/react-router";
import { meQuery } from "@api/queries";
import { ErrorPanel } from "@shared/ui/ErrorPanel";
import { ProPage } from "@views/pro/ProPage";

export const Route = createFileRoute("/pro")({
  loader: ({ context: { queryClient } }) => queryClient.ensureQueryData(meQuery()),
  component: ProPage,
  errorComponent: ErrorPanel,
});
