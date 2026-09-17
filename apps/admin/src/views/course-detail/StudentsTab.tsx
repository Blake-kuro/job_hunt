import type { AdminCourseDetail, AdminCourseStudent } from "@job-hunt/api-client/types";
import { Button } from "@job-hunt/ui/components/button";
import { type Column, DataTable } from "@job-hunt/ui/components/data-table";
import { Pagination } from "@job-hunt/ui/components/pagination";
import { ProgressBar } from "@job-hunt/ui/components/progress-bar";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useRevokeCourseGrant } from "@api/mutations";
import { adminCourseStudentsQuery } from "@api/queries";
import { formatDate } from "@views/courses/format";
import { GrantDialog } from "./GrantDialog";

interface RowActions {
  revokingId?: string;
  onRevoke: (s: AdminCourseStudent) => void;
}

const buildColumns = (a: RowActions): Column<AdminCourseStudent>[] => [
  {
    id: "phone",
    header: "手机号",
    cell: (s) => <span className="tabular-nums">{s.phone ?? "—"}</span>,
  },
  { id: "name", header: "姓名", cell: (s) => <span className="font-medium">{s.name}</span> },
  {
    id: "grantedAt",
    header: "开通时间",
    cell: (s) => <span className="text-neutral-700 tabular-nums">{formatDate(s.grantedAt)}</span>,
  },
  {
    id: "expiresAt",
    header: "到期",
    cell: (s) => {
      if (!s.expiresAt) return <span className="text-neutral-700">永久</span>;
      const expired = new Date(s.expiresAt).getTime() < Date.now();
      return (
        <span className={expired ? "text-red-700 tabular-nums" : "text-neutral-700 tabular-nums"}>
          {formatDate(s.expiresAt)}
          {expired && "（已过期）"}
        </span>
      );
    },
  },
  {
    id: "progress",
    header: "进度",
    cellClassName: "min-w-[160px]",
    cell: (s) =>
      s.progressPercent === null ? (
        <span className="text-xs text-neutral-600">未开始</span>
      ) : (
        <div className="flex items-center gap-2">
          <ProgressBar value={s.progressPercent} className="w-24" />
          <span className="text-xs text-neutral-700 tabular-nums">{s.progressPercent}%</span>
        </div>
      ),
  },
  {
    id: "lastActiveAt",
    header: "最近学习",
    cell: (s) => <span className="text-neutral-700 tabular-nums">{formatDate(s.lastActiveAt)}</span>,
  },
  {
    id: "actions",
    header: "操作",
    cell: (s) => {
      const revoking = a.revokingId === s.userId;
      return (
        <Button size="sm" disabled={revoking} onClick={() => a.onRevoke(s)}>
          {revoking ? "撤销中…" : "撤销"}
        </Button>
      );
    },
  },
];

interface StudentsTabProps {
  course: AdminCourseDetail;
}

/** 已开通学员列表（分页在本地 state，不进 URL）+ 批量开通 / 撤销 */
export function StudentsTab({ course }: StudentsTabProps) {
  const [page, setPage] = useState(1);
  const { data, error, isPending } = useQuery(adminCourseStudentsQuery(course.id, page));
  const revoke = useRevokeCourseGrant();
  const [granting, setGranting] = useState(false);

  function confirmRevoke(s: AdminCourseStudent) {
    if (!window.confirm(`撤销「${s.name}」的开通？学习进度保留，再次开通后可继续`)) return;
    revoke.mutate({ courseId: course.id, userId: s.userId });
  }
  const revokingId = revoke.isPending ? revoke.variables?.userId : undefined;
  const columns = buildColumns({ revokingId, onRevoke: confirmRevoke });

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm text-neutral-700">
          {course.priceCents === 0 ? "免费课无需开通即可观看；" : ""}
          按课开通的学员可完整观看本课。学生页的「授权」也能看到这些记录。
        </p>
        <div className="ml-auto">
          <Button variant="primary" onClick={() => setGranting(true)}>
            开通学员
          </Button>
        </div>
      </div>

      {(revoke.error || error) && (
        <p role="alert" className="mt-3 text-xs text-red-700">
          {revoke.error ? `撤销失败：${revoke.error.message}` : `加载失败：${error?.message}`}
        </p>
      )}

      <div className="mt-4">
        {isPending ? (
          <p className="py-10 text-center text-sm text-neutral-700">加载中…</p>
        ) : (
          data && (
            <>
              <DataTable
                columns={columns}
                rows={data.items}
                rowKey={(s) => s.userId}
                caption="已开通学员"
                layout="auto"
                nowrap
                flush
                emptyMessage="还没有开通任何学员"
              />
              <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onChange={setPage} />
            </>
          )
        )}
      </div>

      <GrantDialog courseId={course.id} open={granting} onClose={() => setGranting(false)} />
    </>
  );
}
