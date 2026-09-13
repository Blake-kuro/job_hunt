import { createFileRoute, stripSearchParams } from "@tanstack/react-router";
import { jobsQuery, progressQuery } from "@api/queries";
import { ErrorPanel } from "@shared/ui/ErrorPanel";
import { JobBoardPage } from "@views/job-board/JobBoardPage";
import { jobListSearchSchema } from "./-search";

/** 等于默认值的 search 不写进 URL */
const defaults = { sort: "deadline", page: 1, pageSize: 20 } as const;

export const Route = createFileRoute("/")({
  validateSearch: jobListSearchSchema,
  search: { middlewares: [stripSearchParams(defaults)] },
  loaderDeps: ({ search }) => search,
  loader: ({ context: { queryClient }, deps }) =>
    Promise.all([queryClient.ensureQueryData(jobsQuery(deps)), queryClient.ensureQueryData(progressQuery())]),
  component: JobBoardPage,
  errorComponent: ErrorPanel,
});
