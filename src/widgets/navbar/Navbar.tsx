import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { cn } from "@shared/lib/cn";

interface NavbarProps {
  active: "jobs" | "practice";
  /** 右侧的状态文字，窄屏隐藏 */
  trailing?: ReactNode;
}

const links = [
  { to: "/", label: "岗位信息", key: "jobs" },
  { to: "/practice", label: "刷题", key: "practice" },
] as const;

export function Navbar({ active, trailing }: NavbarProps) {
  return (
    <header className="flex items-center gap-4 border-b border-divider px-4 py-3.5 sm:gap-8 sm:px-8">
      <div className="flex items-center gap-2.5 font-heading text-lg font-semibold">
        <span className="block size-4 bg-accent" />
        <span>职寻</span>
        <span className="hidden pt-0.5 font-body text-[10px] tracking-[0.18em] text-neutral-600 sm:block">CAMPUS</span>
      </div>

      <nav className="flex items-center gap-4 sm:gap-8">
        {links.map((link) => (
          <Link
            key={link.key}
            to={link.to}
            aria-current={active === link.key ? "page" : undefined}
            className={cn(
              "text-sm transition-colors hover:text-accent",
              active === link.key ? "text-accent" : "text-text",
            )}
          >
            {link.label}
          </Link>
        ))}
      </nav>

      <div className="flex-1" />
      {trailing && <span className="hidden text-xs tabular-nums text-neutral-700 md:block">{trailing}</span>}
      <span className="text-xs text-neutral-700">开发账号</span>
    </header>
  );
}
