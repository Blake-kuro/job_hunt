import type { SelectHTMLAttributes } from "react";
import { cn } from "@shared/lib/cn";

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "min-h-10 w-full border border-divider bg-surface px-3 text-sm text-text",
        "hover:border-text/45 focus-visible:border-accent focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
      {...rest}
    >
      {children}
    </select>
  );
}
