import type * as React from "react";
import { cn } from "../lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "min-h-9 w-full min-w-0 border border-divider bg-surface px-2.5 py-1.5 text-sm text-text caret-accent outline-none placeholder:text-neutral-600 hover:border-text/45 focus-visible:border-accent disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive",
        "file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
