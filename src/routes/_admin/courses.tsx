import { createFileRoute } from "@tanstack/react-router";
import { coursesQuery } from "@api/queries";
import { ErrorPanel } from "@shared/ui/ErrorPanel";

export const Route = createFileRoute("/_admin/courses")({
  loader: ({ context: { queryClient } }) => queryClient.ensureQueryData(coursesQuery()),
  component: () => <h1 className="text-3xl">课程</h1>,
  errorComponent: ErrorPanel,
});
