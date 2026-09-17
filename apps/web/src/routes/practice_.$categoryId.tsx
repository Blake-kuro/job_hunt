import { createFileRoute } from "@tanstack/react-router";
import { meQuery, quizDashboardQuery, quizNextQuery } from "@api/queries";
import { RouterErrorPanel } from "./-error";
import { PracticePage } from "@views/practice/PracticePage";

export const Route = createFileRoute("/practice_/$categoryId")({
  loader: async ({ context: { queryClient }, params }) => {
    // 先建立游客会话，避免首屏并发请求各自落到不同的游客账号。
    await queryClient.ensureQueryData(meQuery());
    return Promise.all([
      // 每次进入都取最新的"下一题"，之后由页面在「下一题」时手动刷新。
      queryClient.fetchQuery({ ...quizNextQuery(params.categoryId), staleTime: 0 }),
      queryClient.ensureQueryData(quizDashboardQuery()),
    ]);
  },
  component: PracticePage,
  errorComponent: RouterErrorPanel,
});
