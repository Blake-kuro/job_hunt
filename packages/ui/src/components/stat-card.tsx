import type { ReactNode } from "react";
import { cn } from "../lib/utils";
import { Kicker } from "./kicker";

interface StatCardProps {
  label: string;
  value: number | string;
  hint?: string;
  /** 数字下方的附加内容（例如操作按钮） */
  children?: ReactNode;
  className?: string;
}

/**
 * 数据概览卡：Kicker 标签 + 大号数字 + 可选提示。
 * 不含路由链接；需要整卡可点击时外层包 `<Link className="block …">`，
 * 并给 StatCard 传 `className="transition-colors hover:border-accent hover:bg-accent-100"`。
 */
export function StatCard({ label, value, hint, children, className }: StatCardProps) {
  return (
    <div data-slot="stat-card" className={cn("border border-divider bg-surface px-5 py-4", className)}>
      <Kicker className="text-neutral-700">{label}</Kicker>
      <p className="mt-2 font-heading text-4xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-neutral-600">{hint}</p>}
      {children}
    </div>
  );
}
