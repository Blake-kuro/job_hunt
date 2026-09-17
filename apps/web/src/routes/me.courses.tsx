import { createFileRoute } from "@tanstack/react-router";
import { meQuery, myCoursesQuery } from "@api/queries";
import { RouterErrorPanel } from "./-error";
import { MyCoursesPage } from "@views/courses/MyCoursesPage";

export const Route = createFileRoute("/me/courses")({
  loader: async ({ context: { queryClient } }) => {
    await queryClient.ensureQueryData(meQuery());
    return queryClient.ensureQueryData(myCoursesQuery());
  },
  component: MyCoursesPage,
  errorComponent: RouterErrorPanel,
});
