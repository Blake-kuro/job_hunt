import type { AdminMaterial } from "@job-hunt/api-client/types";
import { Badge } from "@job-hunt/ui/components/badge";
import { Button } from "@job-hunt/ui/components/button";
import { type Column, DataTable } from "@job-hunt/ui/components/data-table";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useDeleteContent } from "@api/mutations";
import { materialsQuery } from "@api/queries";
import { MaterialDialog } from "./MaterialDialog";

type DialogState = { mode: "create" } | { mode: "edit"; material: AdminMaterial } | null;

interface RowActions {
  deletingId?: string;
  onEdit: (m: AdminMaterial) => void;
  onDelete: (m: AdminMaterial) => void;
}

const buildColumns = (a: RowActions): Column<AdminMaterial>[] => [
  {
    id: "title",
    header: "标题",
    cell: (m) => (
      <div className="max-w-[320px]">
        <div className="truncate font-medium" title={m.title}>
          {m.title}
        </div>
        {m.description && (
          <div className="truncate text-xs text-neutral-600" title={m.description}>
            {m.description}
          </div>
        )}
      </div>
    ),
  },
  { id: "category", header: "分类", cell: (m) => <span className="text-neutral-700">{m.category}</span> },
  {
    id: "url",
    header: "链接",
    cell: (m) => (
      <a
        href={m.resourceUrl}
        target="_blank"
        rel="noreferrer"
        title={m.resourceUrl}
        className="block max-w-[260px] truncate text-accent underline-offset-2 hover:underline"
      >
        {m.resourceUrl}
      </a>
    ),
  },
  { id: "published", header: "状态", cell: (m) => <Badge>{m.published ? "已发布" : "未发布"}</Badge> },
  {
    id: "updatedAt",
    header: "更新时间",
    cell: (m) => (
      <span className="text-neutral-700 tabular-nums">{new Date(m.updatedAt).toLocaleDateString("zh-CN")}</span>
    ),
  },
  {
    id: "actions",
    header: "操作",
    cell: (m) => {
      const busy = a.deletingId === m.id;
      return (
        <div className="flex gap-1.5">
          <Button size="sm" onClick={() => a.onEdit(m)}>
            编辑
          </Button>
          <Button size="sm" disabled={busy} onClick={() => a.onDelete(m)}>
            {busy ? "删除中…" : "删除"}
          </Button>
        </div>
      );
    },
  },
];

export function MaterialsPage() {
  const { data } = useSuspenseQuery(materialsQuery());
  const remove = useDeleteContent();
  const [dialog, setDialog] = useState<DialogState>(null);

  function confirmDelete(m: AdminMaterial) {
    if (!window.confirm("删除该资料？已授权学生将失去访问")) return;
    remove.mutate({ type: "MATERIAL", id: m.id });
  }
  const deletingId = remove.isPending ? remove.variables?.id : undefined;
  const columns = buildColumns({
    deletingId,
    onEdit: (material) => setDialog({ mode: "edit", material }),
    onDelete: confirmDelete,
  });

  return (
    <>
      <h1 className="text-3xl">资料</h1>
      <p className="mt-2 text-sm text-neutral-700">
        学生端可下载的资料链接；未发布的资料学生看不到，已发布的需授权后才能访问。
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <span className="text-sm text-neutral-700 tabular-nums">共 {data.length} 份</span>
        <div className="ml-auto flex gap-2">
          <Button variant="primary" onClick={() => setDialog({ mode: "create" })}>
            新增资料
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
          rowKey={(m) => m.id}
          caption="资料列表"
          minWidthClassName="table-auto"
          emptyMessage="还没有资料"
        />
      </div>

      <MaterialDialog
        mode={dialog?.mode ?? "create"}
        material={dialog?.mode === "edit" ? dialog.material : null}
        open={dialog !== null}
        onClose={() => setDialog(null)}
      />
    </>
  );
}
