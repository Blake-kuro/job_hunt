import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type * as React from "react";
import { cn } from "../lib/utils";

/** 样式与 web / admin 原 Button 一致：直角、heading 字体、半粗；默认 secondary / md。 */
const buttonVariants = cva(
  [
    "inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap border font-heading font-semibold leading-tight transition-colors",
    "disabled:cursor-not-allowed disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  ],
  {
    variants: {
      variant: {
        primary: "border-accent bg-accent text-bg hover:bg-accent-600 active:bg-accent-700",
        secondary: "border-divider hover:bg-text/7 active:bg-text/15",
        ghost: "border-transparent text-accent hover:bg-accent/10 active:bg-accent/20",
        destructive: "border-destructive bg-destructive text-white hover:bg-destructive/90 active:bg-destructive/80",
      },
      size: {
        sm: "px-2.5 py-1 text-xs",
        md: "px-3 py-1.5 text-[13px]",
        lg: "px-4 py-2 text-sm",
      },
    },
    defaultVariants: {
      variant: "secondary",
      size: "md",
    },
  },
);

type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    /** 蓝图四角定位标记（样式见 tokens.css 的 .blueprint / .corner） */
    blueprint?: boolean;
    /** 把样式合并到子元素上（例如 `<Button asChild><Link …/></Button>`） */
    asChild?: boolean;
  };

function Button({
  className,
  variant = "secondary",
  size = "md",
  blueprint = false,
  asChild = false,
  children,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size }), blueprint && "blueprint", className)}
      {...props}
    >
      {/* asChild 时 Slot 只能有一个可替换子元素：children 用 Slottable 标记，角标留在外面 */}
      <Slot.Slottable>{children}</Slot.Slottable>
      {blueprint && (
        <>
          <i className="corner tl" />
          <i className="corner tr" />
          <i className="corner bl" />
          <i className="corner br" />
        </>
      )}
    </Comp>
  );
}

export { Button, type ButtonProps, buttonVariants };
