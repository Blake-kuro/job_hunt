import { Slot } from "radix-ui";
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
  /**
   * 把卡片样式合并到子元素上；需要整卡可点击时用
   * `<StatCard asChild …><Link to="…" /></StatCard>`（不依赖 router）。
   */
  asChild?: boolean;
}

/** 数据概览卡：Kicker 标签 + 大号数字 + 可选提示。 */
export function StatCard({ label, value, hint, children, className, asChild = false }: StatCardProps) {
  const Comp = asChild ? Slot.Root : "div";
  return (
    <Comp
      data-slot="stat-card"
      className={cn(
        "block border border-divider bg-surface px-5 py-4",
        asChild && "transition-colors hover:border-accent hover:bg-accent-100",
        className,
      )}
    >
      <Kicker className="text-neutral-700">{label}</Kicker>
      <p className="mt-2 font-heading text-4xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-neutral-600">{hint}</p>}
      {children}
    </Comp>
  );
}
