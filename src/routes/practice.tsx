import { createFileRoute, redirect } from "@tanstack/react-router";
import { companySetsQuery, meQuery, quizDashboardQuery, quizTodayQuery } from "@api/queries";
import { ErrorPanel } from "@shared/ui/ErrorPanel";
import { PracticePage } from "@views/practice/PracticePage";
import { ApiError } from "../api/client";

export const Route = createFileRoute("/practice")({
  beforeLoad: async ({ context: { queryClient }, location }) => {
    try {
      await queryClient.ensureQueryData(meQuery());
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        throw redirect({ to: "/login", search: { redirect: location.href } });
      }
      throw error;
    }
  },
  loader: ({ context: { queryClient } }) =>
    Promise.all([
      queryClient.fetchQuery({ ...quizTodayQuery(), staleTime: 0 }),
      queryClient.ensureQueryData(quizDashboardQuery()),
      queryClient.ensureQueryData(companySetsQuery()),
    ]),
  component: PracticePage,
  errorComponent: ErrorPanel,
});
