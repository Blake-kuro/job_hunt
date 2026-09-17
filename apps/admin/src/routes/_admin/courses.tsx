import { createFileRoute, stripSearchParams } from "@tanstack/react-router";
import { z } from "zod";
import { adminCoursesQuery } from "@api/queries";
import { RouterErrorPanel } from "../-error";
import { CoursesPage } from "@views/courses/CoursesPage";

/** 与后端 listAdminCourses 的 query 同步；只用于 validateSearch */
const searchSchema = z.object({
  q: z.coerce.string().trim().min(1).optional(),
  published: z.boolean().optional(),
  page: z.number().int().min(1).default(1),
});

const defaults = { page: 1 } as const;

export const Route = createFileRoute("/_admin/courses")({
  validateSearch: searchSchema,
  search: { middlewares: [stripSearchParams(defaults)] },
  loaderDeps: ({ search }) => search,
  loader: ({ context: { queryClient }, deps }) => queryClient.ensureQueryData(adminCoursesQuery(deps)),
  component: CoursesPage,
  errorComponent: RouterErrorPanel,
});
