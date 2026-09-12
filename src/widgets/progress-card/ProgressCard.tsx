import { BlueprintCard } from "@shared/ui/BlueprintCard";

const progress = [
  { value: "24", label: "已收藏" },
  { value: "11", label: "已投递" },
  { value: "3", label: "面试中" },
];

export function ProgressCard() {
  return (
    <BlueprintCard className="px-5 py-[18px]">
      <p className="text-[10px] uppercase tracking-[0.1em] text-accent">我的进度</p>

      <div className="mt-3.5 grid grid-cols-3 gap-3">
        {progress.map((p) => (
          <div key={p.label}>
            <div className="font-heading text-3xl leading-none tabular-nums">{p.value}</div>
            <div className="mt-1 text-[11px] text-neutral-700">{p.label}</div>
          </div>
        ))}
      </div>

      <div className="my-3 h-px bg-divider" />

      <div className="flex items-center justify-between gap-2 text-xs text-neutral-700">
        <span>下一个截止：美团 数据分析实习</span>
        <span className="shrink-0 tabular-nums text-accent-800">7 天</span>
      </div>
    </BlueprintCard>
  );
}
