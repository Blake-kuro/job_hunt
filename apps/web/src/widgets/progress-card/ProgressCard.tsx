import type { JobProgress } from "@entities/job";
import { BlueprintPanel, BlueprintStat } from "@job-hunt/ui/components/blueprint-panel";

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
    <BlueprintPanel title="我的进度">
      <div className="mt-3.5 grid grid-cols-3 gap-3">
        {stats.map((s) => (
          <BlueprintStat key={s.label} value={s.value} label={s.label} />
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
    </BlueprintPanel>
  );
}
