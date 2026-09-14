import { createFileRoute, stripSearchParams } from "@tanstack/react-router";
import { z } from "zod";
import { jobsQuery } from "@api/queries";
import { ErrorPanel } from "@shared/ui/ErrorPanel";
import { JobsPage } from "@views/jobs/JobsPage";

/** 与后端 listAdminJobs 的 query 同步；只用于 validateSearch */
const searchSchema = z.object({
  q: z.coerce.string().trim().min(1).optional(),
  category: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
  page: z.number().int().min(1).default(1),
});

const defaults = { page: 1 } as const;

export const Route = createFileRoute("/_admin/jobs")({
  validateSearch: searchSchema,
  search: { middlewares: [stripSearchParams(defaults)] },
  loaderDeps: ({ search }) => search,
  loader: ({ context: { queryClient }, deps }) => queryClient.ensureQueryData(jobsQuery(deps)),
  component: JobsPage,
  errorComponent: ErrorPanel,
});
