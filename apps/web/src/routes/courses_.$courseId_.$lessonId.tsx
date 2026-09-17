import { createFileRoute } from "@tanstack/react-router";
import { courseQuery, meQuery } from "@api/queries";
import { RouterErrorPanel } from "./-error";
import { PlayerPage } from "@views/courses/PlayerPage";

/** 播放页不套课程页布局（courses_ / $courseId_ 都是 pathless 断开） */
export const Route = createFileRoute("/courses_/$courseId_/$lessonId")({
  loader: async ({ context: { queryClient }, params }) => {
    await queryClient.ensureQueryData(meQuery());
    // 课时列表 / 续播位置来自课程详情；播放签名由页面按需请求（不可播的课时不请求）
    return queryClient.ensureQueryData(courseQuery(params.courseId));
  },
  component: PlayerPage,
  errorComponent: RouterErrorPanel,
});
