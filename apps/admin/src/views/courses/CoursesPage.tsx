import type { AdminCourse } from "@job-hunt/api-client/types";
import { Badge } from "@job-hunt/ui/components/badge";
import { Button } from "@job-hunt/ui/components/button";
import { type Column, DataTable } from "@job-hunt/ui/components/data-table";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useDeleteContent } from "@api/mutations";
import { coursesQuery } from "@api/queries";
import { CourseDialog } from "./CourseDialog";

type DialogState = { mode: "create" } | { mode: "edit"; course: AdminCourse } | null;

interface RowActions {
  deletingId?: string;
  onEdit: (c: AdminCourse) => void;
  onDelete: (c: AdminCourse) => void;
}

const buildColumns = (a: RowActions): Column<AdminCourse>[] => [
  {
    id: "title",
    header: "标题",
    cell: (c) => (
      <div className="max-w-[360px]">
        <div className="truncate font-medium" title={c.title}>
          {c.title}
        </div>
        {c.description && (
          <div className="truncate text-xs text-neutral-600" title={c.description}>
            {c.description}
          </div>
        )}
      </div>
    ),
  },
  {
    id: "lessons",
    header: "课时数",
    cell: (c) => <span className="text-neutral-700 tabular-nums">{c.lessons.length}</span>,
  },
  { id: "published", header: "状态", cell: (c) => <Badge>{c.published ? "已发布" : "未发布"}</Badge> },
  {
    id: "updatedAt",
    header: "更新时间",
    cell: (c) => (
      <span className="text-neutral-700 tabular-nums">{new Date(c.updatedAt).toLocaleDateString("zh-CN")}</span>
    ),
  },
  {
    id: "actions",
    header: "操作",
    cell: (c) => {
      const busy = a.deletingId === c.id;
      return (
        <div className="flex gap-1.5">
          <Button size="sm" onClick={() => a.onEdit(c)}>
            编辑
          </Button>
          <Button size="sm" disabled={busy} onClick={() => a.onDelete(c)}>
            {busy ? "删除中…" : "删除"}
          </Button>
        </div>
      );
    },
  },
];

export function CoursesPage() {
  const { data } = useSuspenseQuery(coursesQuery());
  const remove = useDeleteContent();
  const [dialog, setDialog] = useState<DialogState>(null);

  function confirmDelete(c: AdminCourse) {
    if (!window.confirm("删除该课程？课时与学生授权会一并删除")) return;
    remove.mutate({ type: "COURSE", id: c.id });
  }
  const deletingId = remove.isPending ? remove.variables?.id : undefined;
  const columns = buildColumns({
    deletingId,
    onEdit: (course) => setDialog({ mode: "edit", course }),
    onDelete: confirmDelete,
  });

  return (
    <>
      <h1 className="text-3xl">课程</h1>
      <p className="mt-2 text-sm text-neutral-700">
        视频课程与课时；未发布的课程学生看不到，已发布的需授权后才能观看。
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <span className="text-sm text-neutral-700 tabular-nums">共 {data.length} 门</span>
        <div className="ml-auto flex gap-2">
          <Button variant="primary" onClick={() => setDialog({ mode: "create" })}>
            新增课程
          </Button>
        </div>
      </div>

      {remove.error && (
        <p role="alert" className="mt-3 text-xs text-red-700">
          操作失败：{remove.error.message}
        </p>
      )}

      {/* DataTable 自带 px-4 sm:px-8 内边距，用负外边距抵消以对齐上方工具栏 */}
      <div className="mt-6 -mx-4 sm:-mx-8">
        <DataTable
          columns={columns}
          rows={data}
          rowKey={(c) => c.id}
          caption="课程列表"
          minWidthClassName="table-auto"
          emptyMessage="还没有课程"
        />
      </div>

      <CourseDialog
        mode={dialog?.mode ?? "create"}
        course={dialog?.mode === "edit" ? dialog.course : null}
        open={dialog !== null}
        onClose={() => setDialog(null)}
      />
    </>
  );
}
