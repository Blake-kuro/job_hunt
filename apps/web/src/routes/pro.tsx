import { createFileRoute } from "@tanstack/react-router";
import { meQuery } from "@api/queries";
import { RouterErrorPanel } from "./-error";
import { ProPage } from "@views/pro/ProPage";

export const Route = createFileRoute("/pro")({
  loader: ({ context: { queryClient } }) => queryClient.ensureQueryData(meQuery()),
  component: ProPage,
  errorComponent: RouterErrorPanel,
});
