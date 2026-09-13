import { useEffect, useState } from "react";
import { Segmented } from "@shared/ui/Segmented";
import { Button } from "@shared/ui/Button";
import { Input } from "@shared/ui/Input";
import { cn } from "@shared/lib/cn";
import { CATEGORY_OPTIONS } from "@entities/job";

export type CategoryFilter = "all" | "1" | "2" | "3";
export type SortOrder = "deadline" | "posted";

export const CITY_CHIPS = ["全部", "北京", "上海", "深圳", "杭州", "广州"] as const;

interface JobFiltersProps {
  query: string;
  onQueryChange: (value: string) => void;
  category: CategoryFilter;
  onCategoryChange: (value: CategoryFilter) => void;
  city: string;
  onCityChange: (value: string) => void;
  sort: SortOrder;
  onSortChange: (value: SortOrder) => void;
  onExport: () => void;
}

export function JobFilters({
  query,
  onQueryChange,
  category,
  onCategoryChange,
  city,
  onCityChange,
  sort,
  onSortChange,
  onExport,
}: JobFiltersProps) {
  // 搜索框本地缓冲 + 300ms 防抖，避免每个字符都改 URL
  const [draft, setDraft] = useState(query);
  const [prevQuery, setPrevQuery] = useState(query);
  if (query !== prevQuery) {
    setPrevQuery(query);
    setDraft(query);
  }
  useEffect(() => {
    const normalized = draft.trim();
    if (normalized === query) return;
    const t = setTimeout(() => onQueryChange(normalized), 300);
    return () => clearTimeout(t);
  }, [draft, query, onQueryChange]);

  return (
    <div className="flex flex-col gap-3 border-b border-divider px-4 py-4 sm:px-8 lg:flex-row lg:flex-wrap lg:items-center lg:gap-3.5">
      <Input
        placeholder="搜索公司、岗位或行业"
        className="lg:w-[230px]"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
      />

      <div className="flex flex-wrap items-center gap-3">
        <Segmented
          name="category-filter"
          value={category}
          onChange={onCategoryChange}
          options={CATEGORY_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
        />

        <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
          {CITY_CHIPS.map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={c === city}
              onClick={() => onCityChange(c)}
              className={cn(
                "shrink-0 cursor-pointer rounded-[3px] px-3 py-1.5 text-xs transition-colors",
                c === city ? "bg-accent-100 text-accent-800" : "border border-accent text-accent hover:bg-accent/10",
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="hidden flex-1 lg:block" />

      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[13px] text-neutral-700">排序</span>
        <Segmented
          name="sort-order"
          value={sort}
          onChange={onSortChange}
          options={[
            { value: "deadline", label: "截止最近" },
            { value: "posted", label: "最新发布" },
          ]}
        />
        <Button onClick={onExport}>导出列表</Button>
      </div>
    </div>
  );
}
