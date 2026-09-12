import type { ReactNode } from "react";
import { cn } from "@shared/lib/cn";

export interface Column<T> {
  id: string;
  header: string;
  /** 表头是否仅对读屏软件可见（例如收藏星标列） */
  headerSrOnly?: boolean;
  /** 桌面端列宽，写成百分比，全部列相加应为 100% */
  width: string;
  align?: "left" | "right";
  cell: (row: T) => ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  /** 窄屏（lg 断点以下）每行的卡片渲染方式 */
  renderCard: (row: T) => ReactNode;
  caption: string;
  emptyMessage?: string;
  /** 桌面端表格的最小宽度，低于此宽度横向滚动 */
  minWidthClassName?: string;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  renderCard,
  caption,
  emptyMessage = "没有匹配的结果。",
  minWidthClassName = "min-w-[920px]",
}: DataTableProps<T>) {
  if (rows.length === 0) {
    return <p className="px-4 py-10 text-center text-sm text-neutral-700 sm:px-8">{emptyMessage}</p>;
  }

  return (
    <>
      {/* 窄屏：卡片列表 */}
      <ul className="divide-y divide-hairline border-t border-divider lg:hidden">
        {rows.map((row) => (
          <li key={rowKey(row)} className="px-4 py-4 sm:px-6">
            {renderCard(row)}
          </li>
        ))}
      </ul>

      {/* 宽屏：完整表格 */}
      <div className="hidden overflow-x-auto px-4 pb-6 sm:px-8 lg:block">
        <table className={cn("w-full table-fixed border-collapse text-sm", minWidthClassName)}>
          <caption className="sr-only">{caption}</caption>
          <colgroup>
            {columns.map((col) => (
              <col key={col.id} style={{ width: col.width }} />
            ))}
          </colgroup>
          <thead>
            <tr className="border-b border-divider">
              {columns.map((col) => (
                <th
                  key={col.id}
                  scope="col"
                  className={cn(
                    "h-10 pr-3.5 text-[11px] font-normal uppercase tracking-[0.08em] text-neutral-700",
                    col.align === "right" ? "text-right" : "text-left",
                  )}
                >
                  <span className={cn(col.headerSrOnly && "sr-only")}>{col.header}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={rowKey(row)} className="border-b border-hairline">
                {columns.map((col) => (
                  <td
                    key={col.id}
                    className={cn("h-[62px] pr-3.5 align-middle", col.align === "right" ? "text-right" : "text-left")}
                  >
                    {col.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
