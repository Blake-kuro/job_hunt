import { useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useDeleteContent } from "@api/mutations";
import { materialsQuery } from "@api/queries";
import type { AdminMaterial } from "@api/types";
import { Button } from "@shared/ui/Button";
import { Tag } from "@shared/ui/Tag";
import { MaterialDialog } from "./MaterialDialog";

const th = "px-3 py-2 text-left text-[11px] font-medium uppercase tracking-[0.08em] text-neutral-700";
const td = "px-3 py-2.5 align-top whitespace-nowrap";

type DialogState = { mode: "create" } | { mode: "edit"; material: AdminMaterial } | null;

export function MaterialsPage() {
  const { data } = useSuspenseQuery(materialsQuery());
  const remove = useDeleteContent();
  const [dialog, setDialog] = useState<DialogState>(null);

  function confirmDelete(m: AdminMaterial) {
    if (!window.confirm("删除该资料？已授权学生将失去访问")) return;
    remove.mutate({ type: "MATERIAL", id: m.id });
  }
  const deletingId = remove.isPending ? remove.variables?.id : undefined;

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

      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-divider">
              <th className={th}>标题</th>
              <th className={th}>分类</th>
              <th className={th}>链接</th>
              <th className={th}>状态</th>
              <th className={th}>更新时间</th>
              <th className={th}>操作</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-10 text-center text-neutral-600">
                  还没有资料
                </td>
              </tr>
            )}
            {data.map((m) => {
              const busy = deletingId === m.id;
              return (
                <tr key={m.id} className="border-b border-hairline">
                  <td className={`${td} max-w-[320px]`}>
                    <div className="truncate font-medium" title={m.title}>
                      {m.title}
                    </div>
                    {m.description && (
                      <div className="truncate text-xs text-neutral-600" title={m.description}>
                        {m.description}
                      </div>
                    )}
                  </td>
                  <td className={`${td} text-neutral-700`}>{m.category}</td>
                  <td className={`${td} max-w-[260px]`}>
                    <a
                      href={m.resourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      title={m.resourceUrl}
                      className="block truncate text-accent underline-offset-2 hover:underline"
                    >
                      {m.resourceUrl}
                    </a>
                  </td>
                  <td className={td}>
                    <Tag>{m.published ? "已发布" : "未发布"}</Tag>
                  </td>
                  <td className={`${td} text-neutral-700 tabular-nums`}>
                    {new Date(m.updatedAt).toLocaleDateString("zh-CN")}
                  </td>
                  <td className={td}>
                    <div className="flex gap-1.5">
                      <Button size="sm" onClick={() => setDialog({ mode: "edit", material: m })}>
                        编辑
                      </Button>
                      <Button size="sm" disabled={busy} onClick={() => confirmDelete(m)}>
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

      <MaterialDialog
        mode={dialog?.mode ?? "create"}
        material={dialog?.mode === "edit" ? dialog.material : null}
        open={dialog !== null}
        onClose={() => setDialog(null)}
      />
    </>
  );
}
