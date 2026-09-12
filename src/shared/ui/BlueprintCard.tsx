import type { ReactNode } from "react";
import { cn } from "@shared/lib/cn";

interface BlueprintCardProps {
  children: ReactNode;
  className?: string;
}

export function BlueprintCard({ children, className }: BlueprintCardProps) {
  return (
    <div className={cn("blueprint border border-divider p-4", className)}>
      <i className="corner tl" />
      <i className="corner tr" />
      <i className="corner bl" />
      <i className="corner br" />
      {children}
    </div>
  );
}
