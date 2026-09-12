"use client";

import type { Job } from "@entities/job";
import { actionLabel, deadlineNote, statusVariant } from "@entities/job";
import { Button } from "@shared/ui/Button";
import { Tag } from "@shared/ui/Tag";
import { DataTable, type Column } from "@shared/ui/DataTable";
import { cn } from "@shared/lib/cn";

interface JobTableProps {
  jobs: Job[];
  starredIds: Set<string>;
  appliedIds: Set<string>;
  onToggleStar: (id: string) => void;
  onMarkApplied: (id: string) => void;
}

function isApplied(job: Job, appliedIds: Set<string>): boolean {
  return appliedIds.has(job.id) || job.status === "已投递" || job.status === "面试中";
}

function StarButton({
  starred,
  onClick,
  className,
}: {
  starred: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={starred}
      aria-label={starred ? "取消收藏" : "收藏"}
      onClick={onClick}
      className={cn(
        "cursor-pointer border-none bg-transparent p-0 text-[15px] leading-none",
        starred ? "text-accent" : "text-neutral-400 hover:text-neutral-600",
        className,
      )}
    >
      {starred ? "★" : "☆"}
    </button>
  );
}

function DeadlineCell({ job }: { job: Job }) {
  const note = deadlineNote(job);
  return (
    <span className="whitespace-nowrap">
      <span className="tabular-nums">{job.deadline}</span>
      <span className={cn("ml-1.5 text-[11px] tabular-nums", note.urgent ? "text-accent-800" : "text-neutral-700")}>
        {note.text}
      </span>
    </span>
  );
}

export function JobTable({ jobs, starredIds, appliedIds, onToggleStar, onMarkApplied }: JobTableProps) {
  const columns: Column<Job>[] = [
    {
      id: "star",
      header: "收藏",
      headerSrOnly: true,
      width: "3%",
      cell: (job) => <StarButton starred={starredIds.has(job.id)} onClick={() => onToggleStar(job.id)} />,
    },
    {
      id: "company",
      header: "公司",
      width: "11.5%",
      cell: (job) => <span className="block truncate font-medium">{job.company}</span>,
    },
    {
      id: "role",
      header: "岗位名称",
      width: "16%",
      cell: (job) => (
        <div className="flex items-center gap-2">
          <span className="truncate">{job.role}</span>
          {job.referral && (
            <Tag variant="outline" className="px-1.5 py-px text-[10px]">
              内推
            </Tag>
          )}
        </div>
      ),
    },
    { id: "city", header: "地点", width: "7%", cell: (job) => <span className="whitespace-nowrap text-neutral-800">{job.city}</span> },
    { id: "type", header: "类型", width: "7%", cell: (job) => <span className="whitespace-nowrap text-neutral-800">{job.type}</span> },
    {
      id: "degree",
      header: "学历要求",
      width: "10%",
      cell: (job) => <span className="whitespace-nowrap text-neutral-800">{job.degree}</span>,
    },
    { id: "deadline", header: "投递截止", width: "11%", cell: (job) => <DeadlineCell job={job} /> },
    { id: "posted", header: "发布时间", width: "9%", cell: (job) => <span className="tabular-nums text-neutral-700">{job.posted}</span> },
    { id: "status", header: "投递状态", width: "9.5%", cell: (job) => <Tag variant={statusVariant[job.status]}>{job.status}</Tag> },
    {
      id: "link",
      header: "官方链接",
      width: "7%",
      cell: () => (
        <a href="#" onClick={(e) => e.preventDefault()} className="text-[13px] text-accent-700 hover:text-accent-900">
          查看 ↗
        </a>
      ),
    },
    {
      id: "action",
      header: "操作",
      width: "9%",
      align: "right",
      cell: (job) => (
        <Button size="sm" disabled={isApplied(job, appliedIds)} onClick={() => onMarkApplied(job.id)}>
          {isApplied(job, appliedIds) ? "已投递" : actionLabel(job.status)}
        </Button>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={jobs}
      rowKey={(job) => job.id}
      caption="在招岗位列表"
      emptyMessage="没有匹配的岗位，换个筛选条件试试。"
      renderCard={(job) => {
        const note = deadlineNote(job);
        const applied = isApplied(job, appliedIds);
        return (
          <div className="flex items-start gap-3">
            <StarButton
              starred={starredIds.has(job.id)}
              onClick={() => onToggleStar(job.id)}
              className="mt-1"
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-heading text-[17px]">{job.role}</span>
                <Tag>{job.type}</Tag>
                {job.referral && (
                  <Tag variant="outline" className="px-1.5 py-px text-[10px]">
                    内推
                  </Tag>
                )}
              </div>
              <p className="mt-1 text-xs text-neutral-700">
                <span className="text-text">{job.company}</span>
                <span className="mx-1.5">·</span>
                {job.city}
                <span className="mx-1.5">·</span>
                {job.degree}
              </p>
              <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-2">
                <span className="text-[13px] tabular-nums">截止 {job.deadline}</span>
                <span className={cn("text-[11px] tabular-nums", note.urgent ? "text-accent-800" : "text-neutral-700")}>
                  {note.text}
                </span>
                <Tag variant={statusVariant[job.status]}>{job.status}</Tag>
                <span className="flex-1" />
                <Button size="sm" disabled={applied} onClick={() => onMarkApplied(job.id)}>
                  {applied ? "已投递" : actionLabel(job.status)}
                </Button>
              </div>
            </div>
          </div>
        );
      }}
    />
  );
}
