import { createFileRoute, redirect, stripSearchParams } from "@tanstack/react-router";
import { meQuery } from "@api/queries";
import { jobsQuery, progressQuery } from "@api/queries";
import { ErrorPanel } from "@shared/ui/ErrorPanel";
import { JobBoardPage } from "@views/job-board/JobBoardPage";
import { jobListSearchSchema } from "./-search";
import { ApiError } from "../api/client";

/** 等于默认值的 search 不写进 URL */
const defaults = { sort: "deadline", page: 1, pageSize: 20 } as const;

export const Route = createFileRoute("/")({
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
  validateSearch: jobListSearchSchema,
  search: { middlewares: [stripSearchParams(defaults)] },
  loaderDeps: ({ search }) => search,
  loader: ({ context: { queryClient }, deps }) =>
    Promise.all([queryClient.ensureQueryData(jobsQuery(deps)), queryClient.ensureQueryData(progressQuery())]),
  component: JobBoardPage,
  errorComponent: ErrorPanel,
});
