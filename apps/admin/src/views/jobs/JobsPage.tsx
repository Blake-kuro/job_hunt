import { useEffect, useRef, useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { useDeleteJob, useImportJobs } from "@api/mutations";
import { jobsQuery } from "@api/queries";
import type { AdminImportResult, AdminJob, CategoryId } from "@api/types";
import { Button } from "@shared/ui/Button";
import { Input } from "@shared/ui/Input";
import { Pagination } from "@shared/ui/Pagination";
import { Select } from "@shared/ui/Select";
import { Tag } from "@shared/ui/Tag";
import { ImportResultDialog } from "./ImportResultDialog";
import { JobDialog } from "./JobDialog";
import { CATEGORY_LABEL } from "./job-form";

const route = getRouteApi("/_admin/jobs");

const th = "px-3 py-2 text-left text-[11px] font-medium uppercase tracking-[0.08em] text-neutral-700";
const td = "px-3 py-2.5 align-top whitespace-nowrap";

type DialogState = { mode: "create" } | { mode: "edit"; job: AdminJob } | null;

export function JobsPage() {
  const search = route.useSearch();
  const navigate = route.useNavigate();
  const { data } = useSuspenseQuery(jobsQuery(search));
  const remove = useDeleteJob();
  const importJobs = useImportJobs();
  const fileRef = useRef<HTMLInputElement>(null);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [importResult, setImportResult] = useState<AdminImportResult | null>(null);

  // 搜索框本地缓冲 + 300ms 防抖，避免每个字符都改 URL
  const query = search.q ?? "";
  const [draft, setDraft] = useState(query);
  const [prevQuery, setPrevQuery] = useState(query);
  if (query !== prevQuery) {
    setPrevQuery(query);
    setDraft(query);
  }
  useEffect(() => {
    const normalized = draft.trim();
    if (normalized === query) return;
    const t = setTimeout(() => navigate({ search: (s) => ({ ...s, q: normalized || undefined, page: 1 }) }), 300);
    return () => clearTimeout(t);
  }, [draft, query, navigate]);

  function confirmDelete(job: AdminJob) {
    if (!window.confirm("删除该岗位？收藏和投递记录会一并删除")) return;
    remove.mutate(job.id);
  }
  const deletingId = remove.isPending ? remove.variables : undefined;

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // 允许再次选同一个文件
    if (!file) return;
    try {
      setImportResult(await importJobs.mutateAsync(file));
    } catch {
      // 错误由 importJobs.error 展示
    }
  }

  const actionError = importJobs.error ?? remove.error;

  return (
    <>
      <h1 className="text-3xl">岗位</h1>
      <p className="mt-2 text-sm text-neutral-700">学生端展示的招聘岗位；可手动维护，也可整表从 Excel 导入。</p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Input
          type="search"
          aria-label="搜索岗位"
          placeholder="搜索企业或岗位"
          className="sm:w-[260px]"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <Select
          aria-label="分类"
          className="min-h-9 sm:w-[150px]"
          value={search.category === undefined ? "" : String(search.category)}
          onChange={(e) => {
            const category = e.target.value === "" ? undefined : (Number(e.target.value) as CategoryId);
            navigate({ search: (s) => ({ ...s, category, page: 1 }) });
          }}
        >
          <option value="">全部分类</option>
          {([1, 2, 3] as CategoryId[]).map((id) => (
            <option key={id} value={String(id)}>
              {CATEGORY_LABEL[id]}
            </option>
          ))}
        </Select>
        <div className="ml-auto flex gap-2">
          <input ref={fileRef} type="file" accept=".xlsx" hidden onChange={onFileChange} />
          <Button disabled={importJobs.isPending} onClick={() => fileRef.current?.click()}>
            {importJobs.isPending ? "导入中…" : "导入 Excel"}
          </Button>
          <Button variant="primary" onClick={() => setDialog({ mode: "create" })}>
            新增岗位
          </Button>
        </div>
      </div>

      {actionError && (
        <p role="alert" className="mt-3 text-xs text-red-700">
          操作失败：{actionError.message}
        </p>
      )}

      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-divider">
              <th className={th}>企业</th>
              <th className={th}>岗位</th>
              <th className={th}>分类</th>
              <th className={th}>城市</th>
              <th className={th}>批次</th>
              <th className={th}>截止</th>
              <th className={th}>数据</th>
              <th className={th}>发布时间</th>
              <th className={th}>操作</th>
            </tr>
          </thead>
          <tbody>
            {data.items.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-10 text-center text-neutral-600">
                  没有符合条件的岗位
                </td>
              </tr>
            )}
            {data.items.map((job) => {
              const busy = deletingId === job.id;
              return (
                <tr key={job.id} className="border-b border-hairline">
                  <td className={td}>
                    <div className="font-medium">{job.enterpriseName}</div>
                    <div className="text-xs text-neutral-600">{job.enterpriseNature ?? "—"}</div>
                  </td>
                  <td className={td}>
                    <div>{job.position}</div>
                    {job.serialNumber && (
                      <div className="text-xs text-neutral-600 tabular-nums">#{job.serialNumber}</div>
                    )}
                  </td>
                  <td className={td}>
                    <Tag>{CATEGORY_LABEL[job.categoryId]}</Tag>
                  </td>
                  <td className={`${td} text-neutral-700`}>{job.workLocation ?? "—"}</td>
                  <td className={`${td} text-neutral-700`}>{job.recruitmentBatch ?? "—"}</td>
                  <td className={td}>
                    <div>{job.deadline ?? "—"}</div>
                    {job.deadlineAt && <div className="text-xs text-neutral-600 tabular-nums">{job.deadlineAt}</div>}
                  </td>
                  <td className={`${td} text-neutral-700 tabular-nums`}>
                    收藏 {job.stats.favorites} · 投递 {job.stats.applications}
                  </td>
                  <td className={`${td} text-neutral-700 tabular-nums`}>
                    {new Date(job.createTime).toLocaleDateString("zh-CN")}
                  </td>
                  <td className={td}>
                    <div className="flex gap-1.5">
                      <Button size="sm" onClick={() => setDialog({ mode: "edit", job })}>
                        编辑
                      </Button>
                      <Button size="sm" disabled={busy} onClick={() => confirmDelete(job)}>
                        {busy ? "删除中…" : "删除"}
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Pagination
        page={data.page}
        pageSize={data.pageSize}
        total={data.total}
        onChange={(page) => navigate({ search: (s) => ({ ...s, page }) })}
      />

      <JobDialog
        mode={dialog?.mode ?? "create"}
        job={dialog?.mode === "edit" ? dialog.job : null}
        open={dialog !== null}
        onClose={() => setDialog(null)}
      />
      <ImportResultDialog result={importResult} onClose={() => setImportResult(null)} />
    </>
  );
}
