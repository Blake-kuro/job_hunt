import type { ReactNode } from "react";
import { cn } from "@shared/lib/cn";

type TagVariant = "accent" | "neutral" | "outline" | "solid";

interface TagProps {
  variant?: TagVariant;
  children: ReactNode;
  className?: string;
}

const variantClass: Record<TagVariant, string> = {
  accent: "bg-accent-100 text-accent-800",
  neutral: "bg-neutral-100 text-neutral-800",
  outline: "border border-accent text-accent",
  solid: "bg-accent text-bg",
};

export function Tag({ variant = "neutral", children, className }: TagProps) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-[3px] px-2.5 py-[3px] text-[11px] tracking-[0.02em]",
        variantClass[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
