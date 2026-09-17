import { createFileRoute } from "@tanstack/react-router";
import { adminCourseQuery } from "@api/queries";
import { RouterErrorPanel } from "../-error";
import { CourseDetailPage } from "@views/course-detail/CourseDetailPage";

/** `courses_.` 前缀：详情页不嵌在课程列表路由里，独占整个页面 */
export const Route = createFileRoute("/_admin/courses_/$courseId")({
  loader: ({ context: { queryClient }, params }) => queryClient.ensureQueryData(adminCourseQuery(params.courseId)),
  component: CourseDetailPage,
  errorComponent: RouterErrorPanel,
});
