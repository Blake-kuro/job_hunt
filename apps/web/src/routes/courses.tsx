import { createFileRoute } from "@tanstack/react-router";
import { coursesQuery, meQuery } from "@api/queries";
import { RouterErrorPanel } from "./-error";
import { CourseCatalogPage } from "@views/courses/CourseCatalogPage";

export const Route = createFileRoute("/courses")({
  loader: async ({ context: { queryClient } }) => {
    // 先建立游客会话，避免首屏并发请求各自落到不同的游客账号。
    await queryClient.ensureQueryData(meQuery());
    return queryClient.ensureQueryData(coursesQuery());
  },
  component: CourseCatalogPage,
  errorComponent: RouterErrorPanel,
});
