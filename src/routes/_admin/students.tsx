import { createFileRoute, stripSearchParams } from "@tanstack/react-router";
import { z } from "zod";
import { studentsQuery } from "@api/queries";
import { ErrorPanel } from "@shared/ui/ErrorPanel";
import { StudentsPage } from "@views/students/StudentsPage";

/** 与后端 listAdminStudents 的 query 同步；只用于 validateSearch */
const searchSchema = z.object({
  q: z.coerce.string().trim().min(1).optional(),
  plan: z.enum(["FREE", "PRO"]).optional(),
  enabled: z.boolean().optional(),
  page: z.number().int().min(1).default(1),
});

/** 等于默认值的 search 不写进 URL */
const defaults = { page: 1 } as const;

export const Route = createFileRoute("/_admin/students")({
  validateSearch: searchSchema,
  search: { middlewares: [stripSearchParams(defaults)] },
  loaderDeps: ({ search }) => search,
  loader: ({ context: { queryClient }, deps }) => queryClient.ensureQueryData(studentsQuery(deps)),
  component: StudentsPage,
  errorComponent: ErrorPanel,
});
