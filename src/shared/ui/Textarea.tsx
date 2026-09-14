import type { TextareaHTMLAttributes } from "react";
import { cn } from "@shared/lib/cn";

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-10 w-full border border-divider bg-surface px-3 py-2 text-sm text-text caret-accent",
        "placeholder:text-neutral-600 hover:border-text/45 focus-visible:border-accent focus-visible:outline-none",
        className,
      )}
      {...rest}
    />
  );
}
