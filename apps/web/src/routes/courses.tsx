import { createFileRoute } from "@tanstack/react-router";
import { coursesQuery, meQuery, myCoursesQuery } from "@api/queries";
import { RouterErrorPanel } from "./-error";
import { CourseCatalogPage } from "@views/courses/CourseCatalogPage";

export const Route = createFileRoute("/courses")({
  loader: async ({ context: { queryClient } }) => {
    // 先建立游客会话，避免首屏并发请求各自落到不同的游客账号。
    await queryClient.ensureQueryData(meQuery());
    await Promise.all([queryClient.ensureQueryData(coursesQuery()), queryClient.ensureQueryData(myCoursesQuery())]);
  },
  component: CourseCatalogPage,
  errorComponent: RouterErrorPanel,
});
