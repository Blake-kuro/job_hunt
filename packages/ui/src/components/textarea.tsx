import type * as React from "react";
import { cn } from "../lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "min-h-20 w-full min-w-0 border border-divider bg-surface px-2.5 py-1.5 text-sm text-text caret-accent outline-none placeholder:text-neutral-600 hover:border-text/45 focus-visible:border-accent disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive",
        "field-sizing-content",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
