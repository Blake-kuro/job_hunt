import { Button } from "./button";

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
}

/** 上一页 / 下一页分页条；total 为 0 时不渲染。 */
export function Pagination({ page, pageSize, total, onChange }: PaginationProps) {
  if (total === 0) return null;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <nav aria-label="分页" className="flex items-center justify-between gap-4 py-4 text-sm text-neutral-700">
      <span className="tabular-nums">
        第 {page} / {pages} 页 · 共 {total} 条
      </span>
      <div className="flex gap-2">
        <Button size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>
          上一页
        </Button>
        <Button size="sm" disabled={page >= pages} onClick={() => onChange(page + 1)}>
          下一页
        </Button>
      </div>
    </nav>
  );
}
