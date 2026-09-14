import type { CategoryId, JobListItem, JobListQuery } from "@entities/job";
import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, useNavigate } from "@tanstack/react-router";
import { useMarkApplied, useToggleFavorite } from "@api/mutations";
import { jobsQuery, progressQuery } from "@api/queries";
import { type CategoryFilter, JobFilters, type SortOrder } from "@features/job-filters/JobFilters";
import { Button } from "@shared/ui/Button";
import { Input } from "@shared/ui/Input";
import { Kicker } from "@shared/ui/Kicker";
import { Tag } from "@shared/ui/Tag";
import { AccessBanner } from "@widgets/access-banner/AccessBanner";
import { JobTable } from "@widgets/job-table/JobTable";
import { Navbar } from "@widgets/navbar/Navbar";
import { ProgressCard } from "@widgets/progress-card/ProgressCard";

const route = getRouteApi("/");

function toCsv(rows: JobListItem[]): string {
  const header = ["公司", "岗位", "地点", "分类", "学历要求", "行业", "投递截止", "发布时间", "投递状态", "公告链接"];
  const lines = rows.map((j) =>
    [
      j.company,
      j.positions.join("；"),
      j.cities.join("；"),
      j.categoryLabel,
      j.degree ?? "",
      j.industry ?? "",
      j.deadlineText ?? "",
      j.postedAt,
      j.applicationStatus ?? "",
      j.announcementLink ?? "",
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(","),
  );
  return [header.join(","), ...lines].join("\n");
}

export function JobBoardPage() {
  const search = route.useSearch();
  const navigate = useNavigate({ from: "/" });
  const { data: result } = useSuspenseQuery(jobsQuery(search));
  const { data: progress } = useSuspenseQuery(progressQuery());
  const toggleFavorite = useToggleFavorite(search);
  const markApplied = useMarkApplied(search);

  /** 局部更新 URL search；city 传 "全部" 表示清除；除翻页外都回到第 1 页 */
  function update(patch: Partial<JobListQuery>, { keepPage = false } = {}) {
    navigate({
      replace: true,
      search: (prev) => {
        const next: JobListQuery = { ...prev, ...(keepPage ? {} : { page: 1 }), ...patch };
        if (next.city === "全部") next.city = undefined;
        return next;
      },
    });
  }

  function handleExport() {
    const blob = new Blob([toCsv(result.items)], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "岗位列表.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));
  const from = result.total === 0 ? 0 : (result.page - 1) * result.pageSize + 1;
  const to = Math.min(result.total, result.page * result.pageSize);

  return (
    <div className="flex min-h-full flex-col bg-bg">
      <Navbar active="jobs" trailing="2027 届 · 秋招进行中" />

      <section className="grid grid-cols-1 items-end gap-8 border-b border-divider px-4 pb-7 pt-8 sm:px-8 sm:pt-10 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-10">
        <div>
          <Kicker className="mb-2.5 text-accent-700">面向在校生的岗位索引</Kicker>
          <h1 className="text-balance text-[32px] sm:text-[42px] lg:text-[52px]">把散落各处的招聘信息，收进一张表</h1>
          <p className="mt-3.5 max-w-[640px] text-[15px] text-neutral-700">
            秋招、央国企、外企的招聘公告收进一张表，标注学历要求与投递截止，收藏、投递状态自己管。
          </p>
          <form
            className="mt-5 flex max-w-[560px] flex-col gap-2.5 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              const q = new FormData(e.currentTarget).get("q");
              const trimmed = typeof q === "string" ? q.trim() : "";
              update({ q: trimmed || undefined });
            }}
          >
            <Input
              key={search.q ?? ""}
              name="q"
              placeholder="搜索公司、岗位或行业"
              className="min-h-10 sm:flex-1"
              defaultValue={search.q ?? ""}
            />
            <Button type="submit" variant="primary" size="lg" blueprint className="min-h-10 px-6">
              检索
            </Button>
          </form>
        </div>
        <ProgressCard progress={progress} />
      </section>

      <div className="flex flex-col gap-2 border-b border-divider bg-accent-100 px-4 py-3 sm:flex-row sm:items-center sm:gap-3.5 sm:px-8">
        <Tag variant="solid" className="self-start">
          本周新增
        </Tag>
        <p className="text-sm">
          新上 <b className="tabular-nums">{progress.newThisWeek}</b> 条公告，其中实习{" "}
          <b className="tabular-nums">{progress.newInternshipsThisWeek}</b> 条
        </p>
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => update({ sort: "posted", city: "全部", category: undefined })}
          className="cursor-pointer self-start text-[13px] text-accent-700 hover:text-accent-900 sm:self-auto"
        >
          按最新发布排序 →
        </button>
      </div>

      <JobFilters
        query={search.q ?? ""}
        onQueryChange={(q) => update({ q: q.trim() || undefined })}
        category={(search.category ? String(search.category) : "all") as CategoryFilter}
        onCategoryChange={(c) => update({ category: c === "all" ? undefined : (Number(c) as CategoryId) })}
        city={search.city ?? "全部"}
        onCityChange={(city) => update({ city })}
        sort={search.sort}
        onSortChange={(sort: SortOrder) => update({ sort })}
        onExport={handleExport}
      />

      {(toggleFavorite.error || markApplied.error) && (
        <p role="alert" className="px-4 py-3 text-sm text-red-700">
          {(toggleFavorite.error || markApplied.error)?.message}
        </p>
      )}
      <JobTable
        saving={toggleFavorite.isPending || markApplied.isPending}
        jobs={result.items}
        onToggleStar={(id) => {
          const job = result.items.find((j) => j.id === id);
          if (job) toggleFavorite.mutate({ id, starred: !job.starred });
        }}
        onMarkApplied={(id) => markApplied.mutate({ id })}
      />

      <div className="flex flex-col items-center justify-between gap-3 px-4 pb-10 pt-5 sm:flex-row sm:px-8">
        <span className="text-xs tabular-nums text-neutral-700">
          显示 {from}–{to}，共 <b>{result.total}</b> 条
        </span>
        <div className="flex items-center gap-1.5">
          <Button disabled={result.page <= 1} onClick={() => update({ page: result.page - 1 }, { keepPage: true })}>
            上一页
          </Button>
          <Button variant="primary" disabled className="min-w-9 tabular-nums">
            {result.page} / {totalPages}
          </Button>
          <Button
            disabled={result.page >= totalPages}
            onClick={() => update({ page: result.page + 1 }, { keepPage: true })}
          >
            下一页
          </Button>
        </div>
      </div>

      {result.page >= totalPages && <AccessBanner access={result.access} kind="jobs" className="mx-4 mb-10 sm:mx-8" />}
    </div>
  );
}
