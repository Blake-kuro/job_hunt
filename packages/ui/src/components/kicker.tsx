import type { ReactNode } from "react";
import { cn } from "../lib/utils";

interface KickerProps {
  children: ReactNode;
  className?: string;
}

/** 小标题：全大写、宽字距的区块标签（设计系统里的 h6）。 */
export function Kicker({ children, className }: KickerProps) {
  return <h6 className={cn("font-heading text-[13px] uppercase tracking-[0.08em]", className)}>{children}</h6>;
}
