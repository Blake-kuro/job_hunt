import type { InputHTMLAttributes } from "react";
import { cn } from "@shared/lib/cn";

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "min-h-9 w-full rounded-[4px] border border-divider bg-surface px-2.5 py-1.5 text-sm text-text caret-accent",
        "placeholder:text-neutral-600 hover:border-text/45 focus-visible:border-accent focus-visible:outline-offset-0",
        className,
      )}
      {...rest}
    />
  );
}
