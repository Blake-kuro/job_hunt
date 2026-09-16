import { cn } from "../lib/utils";

interface ProgressBarProps {
  /** 0–100，越界会被截断 */
  value: number;
  className?: string;
}

/** 细进度条：hairline 底 + 钢蓝填充。 */
export function ProgressBar({ value, className }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0));
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clamped}
      className={cn("h-1.5 w-full bg-hairline", className)}
    >
      {/* 宽度是运行时数值，无法用静态类表达——这是仓库里唯一允许的内联 style（见 AGENTS.md） */}
      <div className="h-full bg-accent transition-[width]" style={{ width: `${clamped}%` }} />
    </div>
  );
}
