import type { ReactNode } from "react";
import { cn } from "../lib/utils";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "./table";

export interface Column<T> {
  id: string;
  header: string;
  /** 表头是否仅对读屏软件可见（例如收藏星标列 / 操作列） */
  headerSrOnly?: boolean;
  /** 列宽（百分比或 px）；提供时用 <colgroup> 固定，全部列相加应为 100% */
  width?: string;
  align?: "left" | "right";
  cell: (row: T) => ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  /** 读屏软件用的表格说明 */
  caption: string;
  emptyMessage?: string;
  /** 提供时窄屏（lg 断点以下）渲染卡片列表、宽屏渲染表格；不提供时始终渲染表格 */
  renderCard?: (row: T) => ReactNode;
  /** 表格的最小宽度，低于此宽度横向滚动 */
  minWidthClassName?: string;
}

/** 列定义驱动的数据表：表头 11px 大写宽字距、行间 hairline，与原 web / admin 手写表一致。 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  caption,
  emptyMessage = "没有匹配的结果。",
  renderCard,
  minWidthClassName,
}: DataTableProps<T>) {
  if (rows.length === 0) {
    return <p className="px-4 py-10 text-center text-sm text-neutral-700 sm:px-8">{emptyMessage}</p>;
  }

  const hasWidths = columns.some((col) => col.width);

  return (
    <>
      {renderCard && (
        <ul className="divide-y divide-hairline border-t border-divider lg:hidden">
          {rows.map((row) => (
            <li key={rowKey(row)} className="px-4 py-4 sm:px-6">
              {renderCard(row)}
            </li>
          ))}
        </ul>
      )}

      <div className={cn("px-4 pb-6 sm:px-8", renderCard && "hidden lg:block")}>
        <Table className={cn("table-fixed border-collapse", minWidthClassName)}>
          <TableCaption className="sr-only">{caption}</TableCaption>
          {hasWidths && (
            <colgroup>
              {columns.map((col) => (
                // 列宽来自列定义（百分比 / px），无法用静态类表达，允许内联 style
                <col key={col.id} style={col.width ? { width: col.width } : undefined} />
              ))}
            </colgroup>
          )}
          <TableHeader>
            <TableRow className="border-b border-divider hover:bg-transparent">
              {columns.map((col) => (
                <TableHead
                  key={col.id}
                  scope="col"
                  className={cn(
                    "h-10 px-0 pr-3.5 text-[11px] font-normal uppercase tracking-[0.08em] text-neutral-700",
                    col.align === "right" ? "text-right" : "text-left",
                  )}
                >
                  <span className={cn(col.headerSrOnly && "sr-only")}>{col.header}</span>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody className="[&_tr:last-child]:border-b">
            {rows.map((row) => (
              <TableRow key={rowKey(row)} className="border-b border-hairline hover:bg-transparent">
                {columns.map((col) => (
                  <TableCell
                    key={col.id}
                    className={cn(
                      "h-[62px] p-0 pr-3.5 align-middle whitespace-normal",
                      col.align === "right" ? "text-right" : "text-left",
                    )}
                  >
                    {col.cell(row)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
