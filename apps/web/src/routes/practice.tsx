import { createFileRoute } from "@tanstack/react-router";
import { meQuery, quizDashboardQuery, quizBanksQuery } from "@api/queries";
import { ErrorPanel } from "@shared/ui/ErrorPanel";
import { PracticePage } from "@views/practice/PracticePage";

export const Route = createFileRoute("/practice")({
  loader: async ({ context: { queryClient } }) => {
    // 先建立游客会话，避免首屏并发请求落到不同游客账号。
    await queryClient.ensureQueryData(meQuery());
    return Promise.all([
      queryClient.ensureQueryData(quizDashboardQuery()),
      queryClient.ensureQueryData(quizBanksQuery()),
    ]);
  },
  component: PracticePage,
  errorComponent: ErrorPanel,
});
