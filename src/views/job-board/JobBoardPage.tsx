"use client";

import { useMemo, useState } from "react";
import { Navbar } from "@widgets/navbar/Navbar";
import { ProgressCard } from "@widgets/progress-card/ProgressCard";
import { JobTable } from "@widgets/job-table/JobTable";
import { JobFilters, type SortOrder, type TypeFilter } from "@features/job-filters/JobFilters";
import { Button } from "@shared/ui/Button";
import { Input } from "@shared/ui/Input";
import { Tag } from "@shared/ui/Tag";
import { Kicker } from "@shared/ui/Kicker";
import { jobs as allJobs, cities } from "@entities/job";

function toCsv(rows: typeof allJobs): string {
  const header = ["公司", "岗位名称", "地点", "类型", "学历要求", "投递截止", "发布时间", "投递状态"];
  const lines = rows.map((j) =>
    [j.company, j.role, j.city, j.type, j.degree, j.deadline, j.posted, j.status]
      .map((v) => `"${v.replace(/"/g, '""')}"`)
      .join(","),
  );
  return [header.join(","), ...lines].join("\n");
}

export function JobBoardPage() {
  const [query, setQuery] = useState("");
  const [type, setType] = useState<TypeFilter>("全部");
  const [city, setCity] = useState<string>("全部");
  const [sort, setSort] = useState<SortOrder>("deadline");
  const [starredIds, setStarredIds] = useState<Set<string>>(
    () => new Set(allJobs.filter((j) => j.starred).map((j) => j.id)),
  );
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const result = allJobs.filter((j) => {
      if (type !== "全部" && j.type !== type) return false;
      if (city !== "全部" && j.city !== city) return false;
      if (q && !`${j.company}${j.role}${j.city}`.toLowerCase().includes(q)) return false;
      return true;
    });
    return result.sort((a, b) =>
      sort === "posted" ? b.posted.localeCompare(a.posted) : a.deadline.localeCompare(b.deadline),
    );
  }, [query, type, city, sort]);

  const newThisWeek = allJobs.filter((j) => j.posted >= "09-07").length;
  const newInternships = allJobs.filter((j) => j.posted >= "09-07" && j.type === "实习").length;

  function toggleStar(id: string) {
    setStarredIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function markApplied(id: string) {
    setAppliedIds((prev) => new Set(prev).add(id));
  }

  function handleExport() {
    const blob = new Blob([toCsv(filtered)], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "岗位列表.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex min-h-full flex-col bg-bg">
      <Navbar active="jobs" trailing="2027 届 · 秋招进行中" />

      <section className="grid grid-cols-1 items-end gap-8 border-b border-divider px-4 pb-7 pt-8 sm:px-8 sm:pt-10 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-10">
        <div>
          <Kicker className="mb-2.5 text-accent-700">面向在校生的岗位索引</Kicker>
          <h1 className="text-[32px] sm:text-[42px] lg:text-[52px]">把散落各处的招聘信息，收进一张表</h1>
          <p className="mt-3.5 max-w-[640px] text-[15px] text-neutral-700">
            实习与校招岗位每日 09:00 同步官方渠道，标注学历要求与投递截止，收藏、投递状态自己管。
          </p>
          <div className="mt-5 flex max-w-[560px] flex-col gap-2.5 sm:flex-row">
            <Input
              placeholder="搜索公司、岗位或城市"
              className="min-h-10 sm:flex-1"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <Button variant="primary" size="lg" blueprint className="min-h-10 px-6">
              检索
            </Button>
          </div>
        </div>
        <ProgressCard />
      </section>

      <div className="flex flex-col gap-2 border-b border-divider bg-accent-100 px-4 py-3 sm:flex-row sm:items-center sm:gap-3.5 sm:px-8">
        <Tag variant="solid" className="self-start">本周新增</Tag>
        <p className="text-sm">
          新上 <b className="tabular-nums">{newThisWeek}</b> 个岗位，其中实习{" "}
          <b className="tabular-nums">{newInternships}</b> 个 · 字节跳动、商汤科技、蔚来 开放新批次
        </p>
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => {
            setCity("全部");
            setSort("posted");
          }}
          className="cursor-pointer self-start text-[13px] text-accent-700 hover:text-accent-900 sm:self-auto"
        >
          只看本周新增 →
        </button>
      </div>

      <JobFilters
        query={query}
        onQueryChange={setQuery}
        type={type}
        onTypeChange={setType}
        city={city}
        onCityChange={setCity}
        cities={cities}
        sort={sort}
        onSortChange={setSort}
        onExport={handleExport}
      />

      <JobTable
        jobs={filtered}
        starredIds={starredIds}
        appliedIds={appliedIds}
        onToggleStar={toggleStar}
        onMarkApplied={markApplied}
      />

      <div className="flex flex-col items-center justify-between gap-3 px-4 pb-10 pt-5 sm:flex-row sm:px-8">
        <span className="text-xs tabular-nums text-neutral-700">
          显示 {filtered.length ? 1 : 0}–{filtered.length}，共 <b>{filtered.length}</b> 个岗位
        </span>
        <div className="flex items-center gap-1.5">
          <Button disabled>上一页</Button>
          <Button variant="primary" disabled className="min-w-9 tabular-nums">1</Button>
          <Button disabled>下一页</Button>
        </div>
      </div>
    </div>
  );
}
