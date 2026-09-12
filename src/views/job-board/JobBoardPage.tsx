"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@widgets/navbar/Navbar";
import { ProgressCard } from "@widgets/progress-card/ProgressCard";
import { JobTable } from "@widgets/job-table/JobTable";
import { JobFilters, type CategoryFilter, type SortOrder } from "@features/job-filters/JobFilters";
import { Button } from "@shared/ui/Button";
import { Input } from "@shared/ui/Input";
import { Tag } from "@shared/ui/Tag";
import { Kicker } from "@shared/ui/Kicker";
import type { ApplicationStatus, CategoryId, JobListItem, JobListQuery, JobListResult, JobProgress } from "@entities/job";

interface JobBoardPageProps {
  query: JobListQuery;
  result: JobListResult;
  progress: JobProgress;
}

/** navigate() 接受的局部更新；city 传 "全部" 表示清除 */
type NavPatch = Partial<Omit<JobListQuery, "category">> & { category?: CategoryId };

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

function buildHref(next: NavPatch): string {
  const sp = new URLSearchParams();
  if (next.category) sp.set("category", String(next.category));
  if (next.city && next.city !== "全部") sp.set("city", next.city);
  if (next.q) sp.set("q", next.q);
  if (next.sort && next.sort !== "deadline") sp.set("sort", next.sort);
  if (next.page && next.page > 1) sp.set("page", String(next.page));
  const qs = sp.toString();
  return qs ? `/?${qs}` : "/";
}

export function JobBoardPage({ query, result, progress }: JobBoardPageProps) {
  const router = useRouter();

  const [items, setItems] = useState(result.items);
  // 导航带来新的 result 时重置本地乐观状态（渲染期间比较，避免 effect 内 setState）
  const [prevResult, setPrevResult] = useState(result);
  if (prevResult !== result) {
    setPrevResult(result);
    setItems(result.items);
  }

  const navigate = useCallback(
    (patch: NavPatch) => {
      router.replace(buildHref({ ...query, page: 1, ...patch }));
    },
    [router, query],
  );

  const patchItem = (id: number, patch: Partial<JobListItem>) =>
    setItems((prev) => prev.map((j) => (j.id === id ? { ...j, ...patch } : j)));

  async function toggleStar(id: number) {
    const before = items.find((j) => j.id === id);
    if (!before) return;
    const starred = !before.starred;
    patchItem(id, { starred });
    const res = await fetch(`/api/jobs/${id}/favorite`, { method: starred ? "PUT" : "DELETE" });
    if (!res.ok) {
      patchItem(id, { starred: before.starred });
      console.error("收藏失败", await res.text());
    }
  }

  async function markApplied(id: number) {
    const before = items.find((j) => j.id === id);
    if (!before) return;
    const status: ApplicationStatus = "APPLIED";
    patchItem(id, { applicationStatus: status });
    const res = await fetch(`/api/jobs/${id}/application`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      patchItem(id, { applicationStatus: before.applicationStatus });
      console.error("标记失败", await res.text());
    }
  }

  function handleExport() {
    const blob = new Blob([toCsv(items)], { type: "text/csv;charset=utf-8;" });
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
          <h1 className="text-[32px] sm:text-[42px] lg:text-[52px]">把散落各处的招聘信息，收进一张表</h1>
          <p className="mt-3.5 max-w-[640px] text-[15px] text-neutral-700">
            秋招、央国企、外企的招聘公告收进一张表，标注学历要求与投递截止，收藏、投递状态自己管。
          </p>
          <form
            className="mt-5 flex max-w-[560px] flex-col gap-2.5 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              const q = new FormData(e.currentTarget).get("q");
              navigate({ q: typeof q === "string" ? q.trim() : "" });
            }}
          >
            <Input name="q" placeholder="搜索公司、岗位或行业" className="min-h-10 sm:flex-1" defaultValue={query.q ?? ""} />
            <Button type="submit" variant="primary" size="lg" blueprint className="min-h-10 px-6">
              检索
            </Button>
          </form>
        </div>
        <ProgressCard progress={progress} />
      </section>

      <div className="flex flex-col gap-2 border-b border-divider bg-accent-100 px-4 py-3 sm:flex-row sm:items-center sm:gap-3.5 sm:px-8">
        <Tag variant="solid" className="self-start">本周新增</Tag>
        <p className="text-sm">
          新上 <b className="tabular-nums">{progress.newThisWeek}</b> 条公告，其中实习{" "}
          <b className="tabular-nums">{progress.newInternshipsThisWeek}</b> 条
        </p>
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => navigate({ sort: "posted", city: "全部", category: undefined })}
          className="cursor-pointer self-start text-[13px] text-accent-700 hover:text-accent-900 sm:self-auto"
        >
          只看本周新增 →
        </button>
      </div>

      <JobFilters
        query={query.q ?? ""}
        onQueryChange={(q) => navigate({ q })}
        category={(query.category ? String(query.category) : "all") as CategoryFilter}
        onCategoryChange={(c) => navigate({ category: c === "all" ? undefined : (Number(c) as CategoryId) })}
        city={query.city ?? "全部"}
        onCityChange={(city) => navigate({ city })}
        sort={query.sort}
        onSortChange={(sort: SortOrder) => navigate({ sort })}
        onExport={handleExport}
      />

      <JobTable jobs={items} onToggleStar={toggleStar} onMarkApplied={markApplied} />

      <div className="flex flex-col items-center justify-between gap-3 px-4 pb-10 pt-5 sm:flex-row sm:px-8">
        <span className="text-xs tabular-nums text-neutral-700">
          显示 {from}–{to}，共 <b>{result.total}</b> 条
        </span>
        <div className="flex items-center gap-1.5">
          <Button disabled={result.page <= 1} onClick={() => navigate({ page: result.page - 1 })}>
            上一页
          </Button>
          <Button variant="primary" disabled className="min-w-9 tabular-nums">
            {result.page} / {totalPages}
          </Button>
          <Button disabled={result.page >= totalPages} onClick={() => navigate({ page: result.page + 1 })}>
            下一页
          </Button>
        </div>
      </div>
    </div>
  );
}
