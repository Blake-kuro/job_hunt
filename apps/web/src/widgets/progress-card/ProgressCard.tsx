import type { JobProgress } from "@entities/job";

interface ProgressCardProps {
  progress: JobProgress;
}

export function ProgressCard({ progress }: ProgressCardProps) {
  const stats = [
    { value: progress.starred, label: "已收藏" },
    { value: progress.applied, label: "已投递" },
    { value: progress.interviewing, label: "面试中" },
  ];

  return (
    <div className="blueprint border border-divider px-5 py-[18px]">
      <i className="corner tl" />
      <i className="corner tr" />
      <i className="corner bl" />
      <i className="corner br" />
      <p className="text-[10px] uppercase tracking-[0.1em] text-accent">我的进度</p>

      <div className="mt-3.5 grid grid-cols-3 gap-3">
        {stats.map((s) => (
          <div key={s.label}>
            <div className="font-heading text-3xl leading-none tabular-nums">{s.value}</div>
            <div className="mt-1 text-[11px] text-neutral-700">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="my-3 h-px bg-divider" />

      <div className="flex items-center justify-between gap-2 text-xs text-neutral-700">
        {progress.nextDeadline ? (
          <>
            <span className="truncate">下一个截止：{progress.nextDeadline.company}</span>
            <span className="shrink-0 tabular-nums text-accent-800">{progress.nextDeadline.daysLeft} 天</span>
          </>
        ) : (
          <span>收藏岗位后这里会提醒最近的截止</span>
        )}
      </div>
    </div>
  );
}
