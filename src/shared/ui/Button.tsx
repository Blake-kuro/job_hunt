import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@shared/lib/cn";

type ButtonVariant = "primary" | "secondary" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  blueprint?: boolean;
  children: ReactNode;
}

const variantClass: Record<ButtonVariant, string> = {
  primary: "bg-accent text-bg border-accent hover:bg-accent-600 active:bg-accent-700",
  secondary: "border-divider hover:bg-text/7 active:bg-text/15",
  ghost: "border-transparent text-accent hover:bg-accent/10 active:bg-accent/20",
};

const sizeClass: Record<ButtonSize, string> = {
  sm: "text-xs px-2.5 py-1",
  md: "text-[13px] px-3 py-1.5",
  lg: "text-sm px-4 py-2",
};

export function Button({
  variant = "secondary",
  size = "md",
  blueprint = false,
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex cursor-pointer items-center justify-center gap-1.5 border font-heading font-semibold leading-tight transition-colors",
        "disabled:cursor-not-allowed disabled:opacity-45",
        variantClass[variant],
        sizeClass[size],
        blueprint && "blueprint",
        className,
      )}
      {...rest}
    >
      {children}
      {blueprint && (
        <>
          <i className="corner tl" />
          <i className="corner tr" />
          <i className="corner bl" />
          <i className="corner br" />
        </>
      )}
    </button>
  );
}
