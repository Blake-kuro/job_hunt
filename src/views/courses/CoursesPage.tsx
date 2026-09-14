import { useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useDeleteContent } from "@api/mutations";
import { coursesQuery } from "@api/queries";
import type { AdminCourse } from "@api/types";
import { Button } from "@shared/ui/Button";
import { Tag } from "@shared/ui/Tag";
import { CourseDialog } from "./CourseDialog";

const th = "px-3 py-2 text-left text-[11px] font-medium uppercase tracking-[0.08em] text-neutral-700";
const td = "px-3 py-2.5 align-top whitespace-nowrap";

type DialogState = { mode: "create" } | { mode: "edit"; course: AdminCourse } | null;

export function CoursesPage() {
  const { data } = useSuspenseQuery(coursesQuery());
  const remove = useDeleteContent();
  const [dialog, setDialog] = useState<DialogState>(null);

  function confirmDelete(c: AdminCourse) {
    if (!window.confirm("删除该课程？课时与学生授权会一并删除")) return;
    remove.mutate({ type: "COURSE", id: c.id });
  }
  const deletingId = remove.isPending ? remove.variables?.id : undefined;

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

      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-divider">
              <th className={th}>标题</th>
              <th className={th}>课时数</th>
              <th className={th}>状态</th>
              <th className={th}>更新时间</th>
              <th className={th}>操作</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-10 text-center text-neutral-600">
                  还没有课程
                </td>
              </tr>
            )}
            {data.map((c) => {
              const busy = deletingId === c.id;
              return (
                <tr key={c.id} className="border-b border-hairline">
                  <td className={`${td} max-w-[360px]`}>
                    <div className="truncate font-medium" title={c.title}>
                      {c.title}
                    </div>
                    {c.description && (
                      <div className="truncate text-xs text-neutral-600" title={c.description}>
                        {c.description}
                      </div>
                    )}
                  </td>
                  <td className={`${td} text-neutral-700 tabular-nums`}>{c.lessons.length}</td>
                  <td className={td}>
                    <Tag>{c.published ? "已发布" : "未发布"}</Tag>
                  </td>
                  <td className={`${td} text-neutral-700 tabular-nums`}>
                    {new Date(c.updatedAt).toLocaleDateString("zh-CN")}
                  </td>
                  <td className={td}>
                    <div className="flex gap-1.5">
                      <Button size="sm" onClick={() => setDialog({ mode: "edit", course: c })}>
                        编辑
                      </Button>
                      <Button size="sm" disabled={busy} onClick={() => confirmDelete(c)}>
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

      <CourseDialog
        mode={dialog?.mode ?? "create"}
        course={dialog?.mode === "edit" ? dialog.course : null}
        open={dialog !== null}
        onClose={() => setDialog(null)}
      />
    </>
  );
}
