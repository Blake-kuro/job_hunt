import { createFileRoute } from "@tanstack/react-router";
import { coursesQuery } from "@api/queries";
import { ErrorPanel } from "@shared/ui/ErrorPanel";
import { CoursesPage } from "@views/courses/CoursesPage";

export const Route = createFileRoute("/_admin/courses")({
  loader: ({ context: { queryClient } }) => queryClient.ensureQueryData(coursesQuery()),
  component: CoursesPage,
  errorComponent: ErrorPanel,
});
