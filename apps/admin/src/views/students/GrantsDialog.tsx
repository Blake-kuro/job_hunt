import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePutStudentAccess } from "@api/mutations";
import { coursesQuery, materialsQuery } from "@api/queries";
import type { AdminAccessBody, AdminStudent, ContentType } from "@api/types";
import { Button } from "@shared/ui/Button";
import { Dialog } from "@shared/ui/Dialog";
import { Input } from "@shared/ui/Input";
import { Select } from "@shared/ui/Select";
import { fromGrants, type GrantRow, toAccessBody } from "./grant-rows";

const FORM_ID = "grants-form";

const typeLabel: Record<ContentType, string> = { MATERIAL: "资料", QUESTION: "题目", COURSE: "课程" };

const emptyRow: GrantRow = { contentType: "MATERIAL", contentId: "", contentTitle: null, expiresAt: "" };

interface GrantsDialogProps {
  student: AdminStudent | null;
  onClose: () => void;
}

/** 单独授权：整表替换学生的资料 / 题目 / 课程访问权 */
export function GrantsDialog({ student, onClose }: GrantsDialogProps) {
  const put = usePutStudentAccess();

  function close() {
    put.reset();
    onClose();
  }

  function save(body: AdminAccessBody) {
    if (!student) return;
    put.mutate({ id: student.id, body }, { onSuccess: close });
  }

  return (
    <Dialog
      open={student !== null}
      title={student ? `授权 · ${student.name}` : "授权"}
      onClose={close}
      wide
      footer={
        <>
          <Button type="button" onClick={close}>
            取消
          </Button>
          <Button variant="primary" type="submit" form={FORM_ID} disabled={put.isPending}>
            {put.isPending ? "保存中…" : "保存"}
          </Button>
        </>
      }
    >
      {student && <GrantsForm key={student.id} student={student} error={put.error?.message ?? null} onSubmit={save} />}
    </Dialog>
  );
}

interface GrantsFormProps {
  student: AdminStudent;
  error: string | null;
  onSubmit: (body: AdminAccessBody) => void;
}

function GrantsForm({ student, error, onSubmit }: GrantsFormProps) {
  const [rows, setRows] = useState<GrantRow[]>(() => fromGrants(student.grants));
  const materials = useQuery(materialsQuery());
  const courses = useQuery(coursesQuery());

  function update(index: number, next: Partial<GrantRow>) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...next } : r)));
  }

  return (
    <form
      id={FORM_ID}
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(toAccessBody(rows));
      }}
    >
      <p className="text-xs text-neutral-600">保存会整体替换该学生的授权；到期日留空表示永久有效。</p>

      {rows.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-[110px_1fr_150px_56px] gap-2 text-[11px] uppercase tracking-[0.08em] text-neutral-700">
            <span>类型</span>
            <span>内容</span>
            <span>到期</span>
            <span />
          </div>
          {rows.map((row, i) => {
            const options =
              row.contentType === "MATERIAL" ? materials.data : row.contentType === "COURSE" ? courses.data : undefined;
            const known = options?.some((o) => o.id === row.contentId) ?? false;
            return (
              <div key={i} className="grid grid-cols-[110px_1fr_150px_56px] items-start gap-2">
                <Select
                  aria-label={`第 ${i + 1} 行类型`}
                  value={row.contentType}
                  onChange={(e) =>
                    update(i, { contentType: e.target.value as ContentType, contentId: "", contentTitle: null })
                  }
                >
                  {(Object.keys(typeLabel) as ContentType[]).map((t) => (
                    <option key={t} value={t}>
                      {typeLabel[t]}
                    </option>
                  ))}
                </Select>

                {row.contentType === "QUESTION" ? (
                  <div className="min-w-0">
                    <Input
                      aria-label={`第 ${i + 1} 行题目 id`}
                      placeholder="题目 id"
                      value={row.contentId}
                      onChange={(e) => update(i, { contentId: e.target.value })}
                    />
                    <div className="mt-1 truncate text-xs text-neutral-600">{row.contentTitle ?? "保存后显示题干"}</div>
                  </div>
                ) : (
                  <Select
                    aria-label={`第 ${i + 1} 行内容`}
                    value={row.contentId}
                    onChange={(e) => {
                      const id = e.target.value;
                      update(i, { contentId: id, contentTitle: options?.find((o) => o.id === id)?.title ?? null });
                    }}
                  >
                    <option value="">{options ? "请选择" : "加载中…"}</option>
                    {row.contentId && !known && (
                      <option value={row.contentId}>{row.contentTitle ?? row.contentId}</option>
                    )}
                    {options?.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.title}
                      </option>
                    ))}
                  </Select>
                )}

                <Input
                  aria-label={`第 ${i + 1} 行到期日期`}
                  type="date"
                  className="min-h-10"
                  value={row.expiresAt}
                  onChange={(e) => update(i, { expiresAt: e.target.value })}
                />

                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="min-h-10"
                  onClick={() => setRows((prev) => prev.filter((_, j) => j !== i))}
                >
                  删除
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <div>
        <Button type="button" size="sm" onClick={() => setRows((prev) => [...prev, emptyRow])}>
          添加一行
        </Button>
      </div>

      {error && (
        <p role="alert" className="text-xs text-red-700">
          保存失败：{error}
        </p>
      )}
    </form>
  );
}
