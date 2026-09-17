import type { AdminImportResult } from "@job-hunt/api-client/types";
import { Button } from "@job-hunt/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@job-hunt/ui/components/dialog";

interface ImportResultDialogProps {
  result: AdminImportResult | null;
  onClose: () => void;
}

/** Excel 导入结果：每个 sheet 的新增 / 更新 / 跳过计数 + 跳过明细 */
export function ImportResultDialog({ result, onClose }: ImportResultDialogProps) {
  return (
    <Dialog open={result !== null} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="gap-0 p-0 sm:max-w-[560px]">
        <DialogHeader className="border-b border-divider px-6 py-4 text-left">
          <DialogTitle className="font-heading text-xl font-semibold">导入结果</DialogTitle>
          <DialogDescription className="sr-only">Excel 导入的新增 / 更新 / 跳过统计</DialogDescription>
        </DialogHeader>
        {result && (
          <div className="flex flex-col gap-5 px-6 py-5">
            {result.sheets.length === 0 && <p className="text-sm text-neutral-700">文件里没有可导入的工作表。</p>}
            {result.sheets.map((sheet) => (
              <section key={sheet.name}>
                <p className="text-sm">
                  <span className="font-medium">{sheet.name}</span>
                  <span className="text-neutral-700 tabular-nums">
                    ：新增 {sheet.created} · 更新 {sheet.updated} · 跳过 {sheet.skipped.length}
                  </span>
                </p>
                {sheet.skipped.length > 0 && (
                  <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-xs text-neutral-700">
                    {sheet.skipped.map((reason) => (
                      // 跳过原因以「第 n 行：」开头，行号在同一个 sheet 里唯一
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
            <p className="text-xs text-neutral-600">
              {result.usedIdKey
                ? "表格带 id 列：按 id 更新已有岗位。"
                : "按 serialNumber 匹配已有岗位，无序号的行直接新增。"}
            </p>
          </div>
        )}
        <DialogFooter className="border-t border-divider px-6 py-4">
          <Button variant="primary" type="button" onClick={onClose}>
            知道了
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
