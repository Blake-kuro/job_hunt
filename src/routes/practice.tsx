import { createFileRoute } from "@tanstack/react-router";
import { companySetsQuery, quizDashboardQuery, quizTodayQuery } from "@api/queries";
import { ErrorPanel } from "@shared/ui/ErrorPanel";
import { PracticePage } from "@views/practice/PracticePage";

export const Route = createFileRoute("/practice")({
  loader: ({ context: { queryClient } }) =>
    Promise.all([
      queryClient.fetchQuery({ ...quizTodayQuery(), staleTime: 0 }),
      queryClient.ensureQueryData(quizDashboardQuery()),
      queryClient.ensureQueryData(companySetsQuery()),
    ]),
  component: PracticePage,
  errorComponent: ErrorPanel,
});
