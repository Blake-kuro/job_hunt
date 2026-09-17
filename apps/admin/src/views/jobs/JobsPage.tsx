import type { AdminImportResult, AdminJob, CategoryId } from "@job-hunt/api-client/types";
import { Badge } from "@job-hunt/ui/components/badge";
import { Button } from "@job-hunt/ui/components/button";
import { type Column, DataTable } from "@job-hunt/ui/components/data-table";
import { Input } from "@job-hunt/ui/components/input";
import { Pagination } from "@job-hunt/ui/components/pagination";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@job-hunt/ui/components/select";
import { useDebouncedSearch } from "@job-hunt/ui/hooks/use-debounced-search";
import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { useCallback, useRef, useState } from "react";
import { useDeleteJob, useImportJobs } from "@api/mutations";
import { jobsQuery } from "@api/queries";
import { ImportResultDialog } from "./ImportResultDialog";
import { JobDialog } from "./JobDialog";
import { CATEGORY_LABEL } from "./job-schema";

const route = getRouteApi("/_admin/jobs");

/** Radix Select 的项不能是空串：筛选里的「全部」用这个哨兵值 */
const ALL = "all";

type DialogState = { mode: "create" } | { mode: "edit"; job: AdminJob } | null;

interface RowActions {
  deletingId?: number;
  onEdit: (job: AdminJob) => void;
  onDelete: (job: AdminJob) => void;
}

const buildColumns = (a: RowActions): Column<AdminJob>[] => [
  {
    id: "enterprise",
    header: "企业",
    cell: (job) => (
      <>
        <div className="font-medium">{job.enterpriseName}</div>
        <div className="text-xs text-neutral-600">{job.enterpriseNature ?? "—"}</div>
      </>
    ),
  },
  {
    id: "position",
    header: "岗位",
    cell: (job) => (
      <>
        <div>{job.position}</div>
        {job.serialNumber && <div className="text-xs text-neutral-600 tabular-nums">#{job.serialNumber}</div>}
      </>
    ),
  },
  { id: "category", header: "分类", cell: (job) => <Badge>{CATEGORY_LABEL[job.categoryId]}</Badge> },
  {
    id: "location",
    header: "城市",
    cell: (job) => <span className="text-neutral-700">{job.workLocation ?? "—"}</span>,
  },
  {
    id: "batch",
    header: "批次",
    cell: (job) => <span className="text-neutral-700">{job.recruitmentBatch ?? "—"}</span>,
  },
  {
    id: "deadline",
    header: "截止",
    cell: (job) => (
      <>
        <div>{job.deadline ?? "—"}</div>
        {job.deadlineAt && <div className="text-xs text-neutral-600 tabular-nums">{job.deadlineAt}</div>}
      </>
    ),
  },
  {
    id: "stats",
    header: "数据",
    cell: (job) => (
      <span className="text-neutral-700 tabular-nums">
        收藏 {job.stats.favorites} · 投递 {job.stats.applications}
      </span>
    ),
  },
  {
    id: "createTime",
    header: "发布时间",
    cell: (job) => (
      <span className="text-neutral-700 tabular-nums">{new Date(job.createTime).toLocaleDateString("zh-CN")}</span>
    ),
  },
  {
    id: "actions",
    header: "操作",
    cell: (job) => {
      const busy = a.deletingId === job.id;
      return (
        <div className="flex gap-1.5">
          <Button size="sm" onClick={() => a.onEdit(job)}>
            编辑
          </Button>
          <Button size="sm" disabled={busy} onClick={() => a.onDelete(job)}>
            {busy ? "删除中…" : "删除"}
          </Button>
        </div>
      );
    },
  },
];

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
  const commitQuery = useCallback(
    (q: string) => navigate({ search: (s) => ({ ...s, q: q || undefined, page: 1 }) }),
    [navigate],
  );
  const [draft, setDraft] = useDebouncedSearch(search.q ?? "", commitQuery);

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
  const columns = buildColumns({
    deletingId,
    onEdit: (job) => setDialog({ mode: "edit", job }),
    onDelete: confirmDelete,
  });

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
          value={search.category === undefined ? ALL : String(search.category)}
          onValueChange={(v) => {
            const category = v === ALL ? undefined : (Number(v) as CategoryId);
            navigate({ search: (s) => ({ ...s, category, page: 1 }) });
          }}
        >
          <SelectTrigger aria-label="分类" className="sm:w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>全部分类</SelectItem>
            {([1, 2, 3] as CategoryId[]).map((id) => (
              <SelectItem key={id} value={String(id)}>
                {CATEGORY_LABEL[id]}
              </SelectItem>
            ))}
          </SelectContent>
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

      <div className="mt-6 pb-6">
        <DataTable
          columns={columns}
          rows={data.items}
          rowKey={(job) => String(job.id)}
          caption="岗位列表"
          layout="auto"
          nowrap
          flush
          emptyMessage="没有符合条件的岗位"
        />
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
