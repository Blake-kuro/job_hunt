import { createFileRoute } from "@tanstack/react-router";
import { courseQuery, meQuery } from "@api/queries";
import { RouterErrorPanel } from "./-error";
import { CoursePage } from "@views/courses/CoursePage";

export const Route = createFileRoute("/courses_/$courseId")({
  loader: async ({ context: { queryClient }, params }) => {
    await queryClient.ensureQueryData(meQuery());
    return queryClient.ensureQueryData(courseQuery(params.courseId));
  },
  component: CoursePage,
  errorComponent: RouterErrorPanel,
});
