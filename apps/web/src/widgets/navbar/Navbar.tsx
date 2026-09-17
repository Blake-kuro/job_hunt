import type { ReactNode } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useLogout } from "@api/mutations";
import { meQuery } from "@api/queries";
import { cn } from "@job-hunt/ui/lib/utils";

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
  const { data: user } = useSuspenseQuery(meQuery());
  const logout = useLogout();
  const navigate = useNavigate();
  const accountLabel = user.phone ? `${user.phone.slice(0, 3)}****${user.phone.slice(-4)}` : user.name;

  async function handleLogout() {
    await logout.mutateAsync();
    navigate({ to: "/", replace: true });
  }

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
      {user.tier === "GUEST" ? (
        <Link to="/login" className="text-sm text-accent-700 hover:text-accent-900">
          登录
        </Link>
      ) : (
        <details className="group relative">
          <summary className="flex cursor-pointer list-none items-center gap-2 text-xs text-neutral-700 marker:hidden">
            <span className="flex size-7 items-center justify-center bg-accent-200 font-heading font-semibold text-accent-900">
              {user.name.slice(0, 1)}
            </span>
            <span className="hidden sm:inline">{accountLabel}</span>
            <span className="text-[9px] transition-transform group-open:rotate-180">▼</span>
          </summary>
          <div className="absolute right-0 top-[calc(100%+10px)] z-30 min-w-44 border border-divider bg-bg p-2 shadow-lg">
            <div className="border-b border-hairline px-2 pb-2">
              <p className="text-sm font-medium">{user.name}</p>
              <p className="mt-0.5 text-xs text-neutral-600">{accountLabel}</p>
              <p className="mt-1 text-[11px] text-accent-700">
                {user.tier === "PRO"
                  ? `PRO${user.proExpiresAt ? ` · 至 ${user.proExpiresAt.slice(0, 10)}` : ""}`
                  : "免费账号"}
              </p>
            </div>
            <Link
              to="/pro"
              className="mt-1 block w-full cursor-pointer px-2 py-2 text-left text-xs text-neutral-700 hover:bg-surface"
            >
              {user.tier === "PRO" ? "我的 PRO" : "升级 PRO"}
            </Link>
            <button
              type="button"
              disabled={logout.isPending}
              onClick={handleLogout}
              className="w-full cursor-pointer px-2 py-2 text-left text-xs text-neutral-700 hover:bg-surface disabled:opacity-50"
            >
              {logout.isPending ? "正在退出…" : "退出登录"}
            </button>
          </div>
        </details>
      )}
    </header>
  );
}
