import { useState, type ReactNode } from "react";
import type { JobListItem } from "@entities/job";
import { isExpired, statusLabel, statusVariant } from "@entities/job";
import { Button } from "@job-hunt/ui/components/button";
import { Badge } from "@job-hunt/ui/components/badge";
import { type Column, DataTable } from "@job-hunt/ui/components/data-table";
import { cn } from "@job-hunt/ui/lib/utils";

interface JobTableProps {
  jobs: JobListItem[];
  saving: boolean;
  onToggleStar: (id: number) => void;
  onMarkApplied: (id: number) => void;
}

function StarButton({
  starred,
  onClick,
  className,
  disabled,
}: {
  disabled: boolean;
  starred: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
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

/** 前 3 个岗位 + "等 N 个"，点击展开 */
function Positions({ positions, className }: { positions: string[]; className?: string }) {
  const [open, setOpen] = useState(false);
  const shown = open ? positions : positions.slice(0, 3);
  const rest = positions.length - 3;
  return (
    <span className={cn("leading-snug", className)}>
      {shown.join("、")}
      {!open && rest > 0 && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="ml-1.5 cursor-pointer text-xs text-accent-700 hover:text-accent-900"
        >
          等 {positions.length} 个
        </button>
      )}
    </span>
  );
}

function DeadlineCell({ job }: { job: JobListItem }) {
  if (job.deadlineAt === null || job.daysLeft === null) {
    return <span className="text-[13px] text-neutral-700">{job.deadlineText ?? "—"}</span>;
  }
  const expired = job.daysLeft < 0;
  return (
    <span className="whitespace-nowrap">
      <span className="tabular-nums">{job.deadlineAt.slice(5)}</span>
      <span
        className={cn(
          "ml-1.5 text-[11px] tabular-nums",
          !expired && job.daysLeft <= 10 ? "text-accent-800" : "text-neutral-700",
        )}
      >
        {expired ? "已截止" : `剩 ${job.daysLeft} 天`}
      </span>
    </span>
  );
}

function ActionButton({
  job,
  onMarkApplied,
  disabled,
}: {
  disabled: boolean;
  job: JobListItem;
  onMarkApplied: (id: number) => void;
}) {
  const applied = job.applicationStatus !== null;
  return (
    <Button size="sm" disabled={disabled || applied || isExpired(job)} onClick={() => onMarkApplied(job.id)}>
      {applied ? "已投递" : "标记已投"}
    </Button>
  );
}

function ExternalLink({ href, children }: { href: string | null; children: ReactNode }) {
  if (!href) return <span className="text-[13px] text-neutral-500">—</span>;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-[13px] text-accent-700 hover:text-accent-900"
    >
      {children}
    </a>
  );
}

export function JobTable({ jobs, onToggleStar, onMarkApplied, saving }: JobTableProps) {
  const columns: Column<JobListItem>[] = [
    {
      id: "star",
      header: "收藏",
      headerSrOnly: true,
      width: "3%",
      cell: (j) => <StarButton disabled={saving} starred={j.starred} onClick={() => onToggleStar(j.id)} />,
    },
    {
      id: "company",
      header: "公司",
      width: "11%",
      cell: (j) => <span className="block truncate font-medium">{j.company}</span>,
    },
    { id: "positions", header: "岗位", width: "22%", cell: (j) => <Positions positions={j.positions} /> },
    {
      id: "cities",
      header: "地点",
      width: "9%",
      cell: (j) => <span className="block truncate text-neutral-800">{j.cities.join(" · ")}</span>,
    },
    {
      id: "category",
      header: "分类",
      width: "8%",
      cell: (j) => <span className="whitespace-nowrap text-neutral-800">{j.categoryLabel}</span>,
    },
    {
      id: "degree",
      header: "学历要求",
      width: "9%",
      cell: (j) => <span className="whitespace-nowrap text-neutral-800">{j.degree ?? "—"}</span>,
    },
    { id: "deadline", header: "投递截止", width: "12%", cell: (j) => <DeadlineCell job={j} /> },
    {
      id: "posted",
      header: "发布",
      width: "7%",
      cell: (j) => <span className="tabular-nums text-neutral-700">{j.postedAt.slice(5)}</span>,
    },
    {
      id: "status",
      header: "投递状态",
      width: "8%",
      cell: (j) => (
        <Badge variant={statusVariant(j.applicationStatus, isExpired(j))}>
          {statusLabel(j.applicationStatus, isExpired(j))}
        </Badge>
      ),
    },
    {
      id: "link",
      header: "公告",
      width: "5%",
      cell: (j) => <ExternalLink href={j.announcementLink}>查看 ↗</ExternalLink>,
    },
    {
      id: "action",
      header: "操作",
      width: "6%",
      align: "right",
      cell: (j) => (
        <span className="inline-flex items-center gap-2">
          {j.deliveryAddress && <ExternalLink href={j.deliveryAddress}>去投递</ExternalLink>}
          <ActionButton disabled={saving} job={j} onMarkApplied={onMarkApplied} />
        </span>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={jobs}
      rowKey={(j) => String(j.id)}
      caption="招聘公告列表"
      emptyMessage="没有匹配的公告，换个筛选条件试试。"
      minWidthClassName="min-w-[1040px]"
      renderCard={(j) => {
        const expired = isExpired(j);
        return (
          <div className="flex items-start gap-3">
            <StarButton disabled={saving} starred={j.starred} onClick={() => onToggleStar(j.id)} className="mt-1" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-heading text-[17px]">{j.company}</span>
                <Badge>{j.categoryLabel}</Badge>
              </div>
              <Positions positions={j.positions} className="mt-1 block text-sm text-neutral-800" />
              <p className="mt-1 text-xs text-neutral-700">
                {j.cities.join(" · ")}
                {j.degree && (
                  <>
                    <span className="mx-1.5">·</span>
                    {j.degree}
                  </>
                )}
              </p>
              <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-2">
                <DeadlineCell job={j} />
                <Badge variant={statusVariant(j.applicationStatus, expired)}>
                  {statusLabel(j.applicationStatus, expired)}
                </Badge>
                <span className="flex-1" />
                <ExternalLink href={j.announcementLink}>公告 ↗</ExternalLink>
                {j.deliveryAddress && <ExternalLink href={j.deliveryAddress}>去投递</ExternalLink>}
                <ActionButton disabled={saving} job={j} onMarkApplied={onMarkApplied} />
              </div>
            </div>
          </div>
        );
      }}
    />
  );
}
