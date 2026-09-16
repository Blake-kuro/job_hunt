import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type * as React from "react";
import { cn } from "../lib/utils";

/** 替代原 web / admin 的 Tag：样式不变（accent / neutral / outline），默认 neutral。 */
const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center rounded-[3px] px-2.5 py-[3px] text-[11px] tracking-[0.02em] whitespace-nowrap [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    variants: {
      variant: {
        neutral: "bg-neutral-100 text-neutral-800",
        accent: "bg-accent-100 text-accent-800",
        outline: "border border-accent text-accent",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  },
);

type BadgeProps = React.ComponentProps<"span"> & VariantProps<typeof badgeVariants> & { asChild?: boolean };

function Badge({ className, variant = "neutral", asChild = false, ...props }: BadgeProps) {
  const Comp = asChild ? Slot.Root : "span";

  return (
    <Comp data-slot="badge" data-variant={variant} className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, type BadgeProps, badgeVariants };
