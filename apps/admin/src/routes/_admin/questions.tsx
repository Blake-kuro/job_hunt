import { createFileRoute, stripSearchParams } from "@tanstack/react-router";
import { z } from "zod";
import { questionsQuery, quizMetaQuery } from "@api/queries";
import { ErrorPanel } from "@shared/ui/ErrorPanel";
import { QuestionsPage } from "@views/questions/QuestionsPage";

/** 与后端 listAdminQuestions 的 query 同步；只用于 validateSearch */
const searchSchema = z.object({
  q: z.coerce.string().trim().min(1).optional(),
  companyId: z.string().trim().min(1).optional(),
  categoryId: z.string().trim().min(1).optional(),
  type: z.enum(["SINGLE", "MULTI", "JUDGE"]).optional(),
  section: z.coerce.string().trim().min(1).optional(),
  published: z.boolean().optional(),
  page: z.number().int().min(1).default(1),
});

const defaults = { page: 1 } as const;

export const Route = createFileRoute("/_admin/questions")({
  validateSearch: searchSchema,
  search: { middlewares: [stripSearchParams(defaults)] },
  loaderDeps: ({ search }) => search,
  loader: ({ context: { queryClient }, deps }) =>
    Promise.all([queryClient.ensureQueryData(questionsQuery(deps)), queryClient.ensureQueryData(quizMetaQuery())]),
  component: QuestionsPage,
  errorComponent: ErrorPanel,
});
