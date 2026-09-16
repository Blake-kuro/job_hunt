import { createFileRoute } from "@tanstack/react-router";
import { meQuery, quizBanksQuery, quizDashboardQuery } from "@api/queries";
import { ErrorPanel } from "@shared/ui/ErrorPanel";
import { BankPickerPage } from "@views/practice/BankPickerPage";

export const Route = createFileRoute("/practice")({
  loader: async ({ context: { queryClient } }) => {
    // 先建立游客会话，避免首屏并发请求各自落到不同的游客账号。
    await queryClient.ensureQueryData(meQuery());
    return Promise.all([
      queryClient.ensureQueryData(quizBanksQuery()),
      queryClient.ensureQueryData(quizDashboardQuery()),
    ]);
  },
  component: BankPickerPage,
  errorComponent: ErrorPanel,
});
