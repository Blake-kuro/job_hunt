import type { ApplicationStatus, JobListQuery, JobListResult, QuizDashboard, QuizOptionLetter } from "@job-hunt/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, unwrap } from "./client";
import { jobsQuery, quizDashboardQuery } from "./queries";

function patchItem(result: JobListResult | undefined, id: number, patch: Partial<JobListResult["items"][number]>) {
  if (!result) return result;
  return { ...result, items: result.items.map((j) => (j.id === id ? { ...j, ...patch } : j)) };
}

export function useToggleFavorite(q: JobListQuery) {
  const qc = useQueryClient();
  const key = jobsQuery(q).queryKey;
  return useMutation({
    mutationFn: ({ id, starred }: { id: number; starred: boolean }) => {
      const param = { id: String(id) };
      return unwrap(
        starred ? api.api.jobs[":id"].favorite.$put({ param }) : api.api.jobs[":id"].favorite.$delete({ param }),
      );
    },
    onMutate: async ({ id, starred }) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData(key);
      qc.setQueryData(key, (old) => patchItem(old, id, { starred }));
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["jobs"] }),
  });
}

export function useMarkApplied(q: JobListQuery) {
  const qc = useQueryClient();
  const key = jobsQuery(q).queryKey;
  const status: ApplicationStatus = "APPLIED";
  return useMutation({
    mutationFn: ({ id }: { id: number }) =>
      unwrap(api.api.jobs[":id"].application.$put({ param: { id: String(id) }, json: { status } })),
    onMutate: async ({ id }) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData(key);
      qc.setQueryData(key, (old) => patchItem(old, id, { applicationStatus: status }));
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["jobs"] }),
  });
}

export function useSubmitAttempt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { questionId: string; picked: QuizOptionLetter }) =>
      unwrap(api.api.quiz.attempts.$post({ json: vars })),
    // 答完题打卡/错题本会变；today 留到用户点"下一题"再失效
    onSuccess: () => qc.invalidateQueries({ queryKey: quizDashboardQuery().queryKey }),
  });
}

export function useSetMastered() {
  const qc = useQueryClient();
  const key = quizDashboardQuery().queryKey;
  return useMutation({
    mutationFn: ({ questionId, mastered }: { questionId: string; mastered: boolean }) =>
      unwrap(api.api.quiz["wrong-book"][":questionId"].$put({ param: { questionId }, json: { mastered } })),
    onMutate: async ({ questionId, mastered }) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData(key);
      if (mastered) {
        qc.setQueryData(key, (old: QuizDashboard | undefined) =>
          old ? { ...old, wrongList: old.wrongList.filter((w) => w.questionId !== questionId) } : old,
        );
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });
}
