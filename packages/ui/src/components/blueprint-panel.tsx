import type { ReactNode } from "react";
import { cn } from "../lib/utils";

interface BlueprintPanelProps {
  /** 左上角的小标题（蓝图图纸式的图名） */
  title: string;
  className?: string;
  children: ReactNode;
}

/** 四角带刻度标记的「蓝图」面板：首页进度卡、网课学习卡共用。角标样式在 tokens.css 的 `.blueprint`。 */
export function BlueprintPanel({ title, className, children }: BlueprintPanelProps) {
  return (
    <div className={cn("blueprint border border-divider px-5 py-[18px]", className)}>
      <i className="corner tl" />
      <i className="corner tr" />
      <i className="corner bl" />
      <i className="corner br" />
      <p className="text-[10px] uppercase tracking-[0.1em] text-accent">{title}</p>
      {children}
    </div>
  );
}

interface StatProps {
  value: ReactNode;
  label: string;
}

/** 面板里的大数字 + 小标签 */
export function BlueprintStat({ value, label }: StatProps) {
  return (
    <div>
      <div className="font-heading text-3xl leading-none tabular-nums">{value}</div>
      <div className="mt-1 text-[11px] text-neutral-700">{label}</div>
    </div>
  );
}
