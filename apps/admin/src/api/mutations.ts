import { type QueryClient, useMutation, useQueryClient } from "@tanstack/react-query";
import { client, unwrap } from "@job-hunt/api-client/client";
import type {
  AdminAccessBody,
  AdminCategoryBody,
  AdminCategoryPatch,
  AdminCompanyBody,
  AdminCompanyPatch,
  AdminJobBody,
  AdminMaterialBody,
  AdminJobPatch,
  AdminQuestionBody,
  AdminQuestionPatch,
  AdminStudentPatch,
} from "@job-hunt/api-client/types";

type AdminResource = "summary" | "students" | "materials" | "courses" | "quiz-meta" | "questions" | "jobs";

/** 写操作成功后失效相关资源的列表缓存 */
function invalidate(qc: QueryClient, ...resources: AdminResource[]) {
  return Promise.all(resources.map((r) => qc.invalidateQueries({ queryKey: ["admin", r] })));
}

// ---- 登录 / 登出 ----

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

/** 登出成功后清空全部缓存；跳转由调用方做 */
export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => unwrap(client.POST("/api/auth/logout")),
    onSuccess: () => qc.clear(),
  });
}

// ---- 学生 ----

export function usePatchStudent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: AdminStudentPatch }) =>
      unwrap(client.PATCH("/api/admin/students/{id}", { params: { path: { id } }, body })),
    onSuccess: () => invalidate(qc, "students", "summary"),
  });
}

export function usePutStudentAccess() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: AdminAccessBody }) =>
      unwrap(client.PUT("/api/admin/students/{id}/access", { params: { path: { id } }, body })),
    onSuccess: () => invalidate(qc, "students", "summary"),
  });
}

// ---- 资料 ----

export function useSaveContent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: AdminMaterialBody) => unwrap(client.POST("/api/admin/content", { body })),
    onSuccess: () => invalidate(qc, "materials", "students", "summary"),
  });
}

export function useDeleteContent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ type, id }: { type: "MATERIAL"; id: string }) =>
      unwrap(client.DELETE("/api/admin/content/{type}/{id}", { params: { path: { type, id } } })),
    onSuccess: () => invalidate(qc, "materials", "students", "summary"),
  });
}

// ---- 题库 ----

export function useCreateQuestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: AdminQuestionBody) => unwrap(client.POST("/api/admin/questions", { body })),
    onSuccess: () => invalidate(qc, "questions", "quiz-meta", "summary"),
  });
}

export function usePatchQuestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: AdminQuestionPatch }) =>
      unwrap(client.PATCH("/api/admin/questions/{id}", { params: { path: { id } }, body })),
    onSuccess: () => invalidate(qc, "questions", "quiz-meta", "summary"),
  });
}

export function useDeleteQuestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => unwrap(client.DELETE("/api/admin/questions/{id}", { params: { path: { id } } })),
    onSuccess: () => invalidate(qc, "questions", "quiz-meta", "students", "summary"),
  });
}

// ---- 公司 / 分类 ----

/** 公司 / 分类的增删改都会影响题目列表（companyName / categoryName）与概览计数 */
const BANK_RESOURCES: AdminResource[] = ["quiz-meta", "questions", "summary"];

export function useCreateCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: AdminCompanyBody) => unwrap(client.POST("/api/admin/companies", { body })),
    onSuccess: () => invalidate(qc, ...BANK_RESOURCES),
  });
}

export function usePatchCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: AdminCompanyPatch }) =>
      unwrap(client.PATCH("/api/admin/companies/{id}", { params: { path: { id } }, body })),
    onSuccess: () => invalidate(qc, ...BANK_RESOURCES),
  });
}

/** 删除公司会级联删除其下分类、题目及作答 / 错题记录 */
export function useDeleteCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => unwrap(client.DELETE("/api/admin/companies/{id}", { params: { path: { id } } })),
    onSuccess: () => invalidate(qc, ...BANK_RESOURCES, "students"),
  });
}

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: AdminCategoryBody) => unwrap(client.POST("/api/admin/question-categories", { body })),
    onSuccess: () => invalidate(qc, ...BANK_RESOURCES),
  });
}

export function usePatchCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: AdminCategoryPatch }) =>
      unwrap(client.PATCH("/api/admin/question-categories/{id}", { params: { path: { id } }, body })),
    onSuccess: () => invalidate(qc, ...BANK_RESOURCES),
  });
}

/** 删除分类会级联删除其下题目及作答 / 错题记录 */
export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(client.DELETE("/api/admin/question-categories/{id}", { params: { path: { id } } })),
    onSuccess: () => invalidate(qc, ...BANK_RESOURCES, "students"),
  });
}

/** 把 xlsx 导入到指定分类；multipart 组装方式同 useImportJobs */
export function useImportQuestions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ categoryId, file }: { categoryId: string; file: File }) =>
      unwrap(
        client.POST("/api/admin/question-categories/{id}/import", {
          params: { path: { id: categoryId } },
          body: { file } as unknown as { file: string },
          bodySerializer: (b) => {
            const fd = new FormData();
            fd.append("file", b.file as unknown as File);
            return fd;
          },
        }),
      ),
    onSuccess: () => invalidate(qc, ...BANK_RESOURCES),
  });
}

// ---- 岗位 ----

export function useCreateJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: AdminJobBody) => unwrap(client.POST("/api/admin/jobs", { body })),
    onSuccess: () => invalidate(qc, "jobs", "summary"),
  });
}

export function usePatchJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: AdminJobPatch }) =>
      unwrap(client.PATCH("/api/admin/jobs/{id}", { params: { path: { id } }, body })),
    onSuccess: () => invalidate(qc, "jobs", "summary"),
  });
}

export function useDeleteJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => unwrap(client.DELETE("/api/admin/jobs/{id}", { params: { path: { id } } })),
    onSuccess: () => invalidate(qc, "jobs", "summary"),
  });
}

export function useImportJobs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) =>
      unwrap(
        client.POST("/api/admin/jobs/import", {
          // openapi 里 file 是 string(binary)，实际发 File；由 bodySerializer 组装 multipart
          body: { file } as unknown as { file: string },
          bodySerializer: (b) => {
            const fd = new FormData();
            fd.append("file", b.file as unknown as File);
            return fd;
          },
        }),
      ),
    onSuccess: () => invalidate(qc, "jobs", "summary"),
  });
}
