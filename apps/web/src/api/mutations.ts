import { useMutation, useQueryClient } from "@tanstack/react-query";
import { client, unwrap } from "@job-hunt/api-client/client";
import { jobsQuery, quizDashboardQuery } from "./queries";
import type {
  ApplicationStatus,
  JobListQuery,
  JobListResult,
  QuizDashboard,
  QuizOptionLetter,
} from "@job-hunt/api-client/types";

export function useSendLoginSms() {
  return useMutation({ mutationFn: (phone: string) => unwrap(client.POST("/api/auth/sms/send", { body: { phone } })) });
}

export function useVerifyLoginSms() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ phone, code }: { phone: string; code: string }) =>
      unwrap(client.POST("/api/auth/sms/verify", { body: { phone, code } })),
    onSuccess: ({ user }) => qc.setQueryData(["auth", "me"], user),
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => unwrap(client.POST("/api/auth/logout")),
    onSuccess: () => qc.clear(),
  });
}

function patchItem(result: JobListResult | undefined, id: number, patch: Partial<JobListResult["items"][number]>) {
  if (!result) return result;
  return { ...result, items: result.items.map((j) => (j.id === id ? { ...j, ...patch } : j)) };
}

export function useToggleFavorite(q: JobListQuery) {
  const qc = useQueryClient();
  const key = jobsQuery(q).queryKey;
  return useMutation({
    mutationFn: ({ id, starred }: { id: number; starred: boolean }) =>
      unwrap(
        starred
          ? client.PUT("/api/jobs/{id}/favorite", { params: { path: { id } } })
          : client.DELETE("/api/jobs/{id}/favorite", { params: { path: { id } } }),
      ),
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
      unwrap(client.PUT("/api/jobs/{id}/application", { params: { path: { id } }, body: { status } })),
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
    mutationFn: (vars: { questionId: string; picked: QuizOptionLetter[] }) =>
      unwrap(client.POST("/api/quiz/attempts", { body: vars })),
    // 保留当前题解析，直到用户主动点击下一题。
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: quizDashboardQuery().queryKey }),
        qc.invalidateQueries({ queryKey: ["quiz", "banks"] }),
      ]),
  });
}

export function useSetMastered() {
  const qc = useQueryClient();
  const key = quizDashboardQuery().queryKey;
  return useMutation({
    mutationFn: ({ questionId, mastered }: { questionId: string; mastered: boolean }) =>
      unwrap(client.PUT("/api/quiz/wrong-book/{questionId}", { params: { path: { questionId } }, body: { mastered } })),
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
