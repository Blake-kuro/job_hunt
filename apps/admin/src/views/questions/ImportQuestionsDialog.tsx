import { Button } from "@job-hunt/ui/components/button";
import { DialogShell } from "@job-hunt/ui/components/dialog-shell";
import { useRef } from "react";
import { useImportQuestions } from "@api/mutations";

export interface ImportTarget {
  categoryId: string;
  categoryName: string;
  companyName: string;
}

interface ImportQuestionsDialogProps {
  target: ImportTarget | null;
  onClose: () => void;
}

const COLUMNS: { name: string; note: string }[] = [
  { name: "题号", note: "可选；作为分类内序号，缺省用行号" },
  { name: "题型", note: "单选题 / 多选题 / 判断题；缺省按答案与选项推断" },
  { name: "所属部分", note: "可选，如「形势政策」「企业文化」" },
  { name: "题干", note: "必填" },
  { name: "A – F", note: "选项文案，2–6 列；判断题可留空（自动补 正确 / 错误）" },
  { name: "答案", note: "字母，如 B 或 ABC；判断题 A = 正确、B = 错误" },
];

/**
 * 把 xlsx 导入到某个分类：选择文件即上传，完成后原地展示结果。
 * 结果 / 错误直接读 mutation 状态，关闭时 reset，避免上传中关闭后旧结果串到下一个分类；
 * 上传进行中不允许关闭（✕ / Esc / 遮罩 / 取消都不响应）。
 */
export function ImportQuestionsDialog({ target, onClose }: ImportQuestionsDialogProps) {
  const importQuestions = useImportQuestions();
  const fileRef = useRef<HTMLInputElement>(null);
  const pending = importQuestions.isPending;
  const result = importQuestions.data ?? null;

  function close() {
    if (pending) return;
    importQuestions.reset();
    onClose();
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // 允许再次选同一个文件
    if (!file || !target) return;
    importQuestions.mutate({ categoryId: target.categoryId, file });
  }

  return (
    <DialogShell
      open={target !== null}
      title="导入 Excel"
      onClose={close}
      closeDisabled={pending}
      bodyClassName="flex flex-col gap-5 text-sm"
      footer={
        <>
          <Button type="button" disabled={pending} onClick={close}>
            {result ? "关闭" : "取消"}
          </Button>
          <Button variant="primary" type="button" disabled={pending} onClick={() => fileRef.current?.click()}>
            {pending ? "导入中…" : result ? "再导入一个" : "选择 xlsx 文件"}
          </Button>
        </>
      }
    >
      {target && (
        <>
          <p>
            导入到{" "}
            <span className="font-medium">
              {target.companyName} / {target.categoryName}
            </span>
            ；表格里的题会追加到该分类，题干相同的行会被跳过。
          </p>
          <input ref={fileRef} type="file" accept=".xlsx" hidden onChange={onFileChange} />

          <section>
            <h3 className="text-xs font-medium uppercase tracking-[0.08em] text-neutral-700">表格格式</h3>
            <p className="mt-1 text-xs text-neutral-600">
              取第一个表头同时含「题干」和「答案」的工作表，列按表头名识别，顺序不限；xlsx 最大 20 MB。
            </p>
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
              {COLUMNS.map((c) => (
                <div key={c.name} className="contents">
                  <dt className="font-medium text-text">{c.name}</dt>
                  <dd className="text-neutral-700">{c.note}</dd>
                </div>
              ))}
            </dl>
          </section>

          {importQuestions.error && (
            <p role="alert" className="text-xs text-red-700">
              导入失败：{importQuestions.error.message}
            </p>
          )}

          {result && (
            <section aria-live="polite" className="border border-divider bg-surface px-4 py-3">
              <p>
                新增 <span className="font-medium tabular-nums">{result.created}</span> 题
                {result.skipped.length > 0 && (
                  <span className="text-neutral-700">
                    ，跳过 <span className="font-medium tabular-nums">{result.skipped.length}</span> 行
                  </span>
                )}
              </p>
              {result.skipped.length > 0 && (
                <ul className="mt-2 flex max-h-56 list-disc flex-col gap-1 overflow-y-auto pl-5 text-xs text-neutral-700">
                  {result.skipped.map((reason) => (
                    // 跳过原因以「第 n 行：」开头，行号在同一次导入里唯一
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </>
      )}
    </DialogShell>
  );
}
