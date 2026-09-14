import { createFileRoute, stripSearchParams } from "@tanstack/react-router";
import { z } from "zod";
import { studentsQuery } from "@api/queries";
import { ErrorPanel } from "@shared/ui/ErrorPanel";

/** 与后端 listAdminStudents 的 query 同步；只用于 validateSearch */
const searchSchema = z.object({
  q: z.string().trim().min(1).optional(),
  plan: z.enum(["FREE", "PRO"]).optional(),
  enabled: z.enum(["true", "false"]).optional(),
  page: z.number().int().min(1).default(1),
});

/** 等于默认值的 search 不写进 URL */
const defaults = { page: 1 } as const;

export const Route = createFileRoute("/_admin/students")({
  validateSearch: searchSchema,
  search: { middlewares: [stripSearchParams(defaults)] },
  loaderDeps: ({ search }) => search,
  loader: ({ context: { queryClient }, deps }) => queryClient.ensureQueryData(studentsQuery(deps)),
  component: () => <h1 className="text-3xl">学生</h1>,
  errorComponent: ErrorPanel,
});
