"use client";

import { Segmented } from "@shared/ui/Segmented";
import { Button } from "@shared/ui/Button";
import { Input } from "@shared/ui/Input";
import { cn } from "@shared/lib/cn";
import type { JobKind } from "@entities/job";

export type TypeFilter = "全部" | JobKind;
export type SortOrder = "deadline" | "posted";

interface JobFiltersProps {
  query: string;
  onQueryChange: (value: string) => void;
  type: TypeFilter;
  onTypeChange: (value: TypeFilter) => void;
  city: string;
  onCityChange: (value: string) => void;
  cities: readonly string[];
  sort: SortOrder;
  onSortChange: (value: SortOrder) => void;
  onExport: () => void;
}

export function JobFilters({
  query,
  onQueryChange,
  type,
  onTypeChange,
  city,
  onCityChange,
  cities,
  sort,
  onSortChange,
  onExport,
}: JobFiltersProps) {
  return (
    <div className="flex flex-col gap-3 border-b border-divider px-4 py-4 sm:px-8 lg:flex-row lg:flex-wrap lg:items-center lg:gap-3.5">
      <Input
        placeholder="搜索岗位或公司"
        className="lg:w-[230px]"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
      />

      <div className="flex flex-wrap items-center gap-3">
        <Segmented
          name="type-filter"
          value={type}
          onChange={onTypeChange}
          options={[
            { value: "全部", label: "全部" },
            { value: "实习", label: "实习" },
            { value: "校招", label: "校招" },
          ]}
        />

        {/* 窄屏城市标签横向滚动，避免挤成多行 */}
        <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
          {cities.map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={c === city}
              onClick={() => onCityChange(c)}
              className={cn(
                "shrink-0 cursor-pointer rounded-[3px] px-3 py-1.5 text-xs transition-colors",
                c === city
                  ? "bg-accent-100 text-accent-800"
                  : "border border-accent text-accent hover:bg-accent/10",
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
