import type * as React from "react";
import { cn } from "../lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "min-h-20 w-full min-w-0 border border-divider bg-surface px-2.5 py-1.5 text-sm text-text caret-accent placeholder:text-neutral-600 rounded-[4px] focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-0 hover:border-text/45 focus-visible:border-accent disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive",
        "field-sizing-content",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
