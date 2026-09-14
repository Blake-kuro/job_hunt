import { Link, useNavigate } from "@tanstack/react-router";
import { useLogout } from "@api/mutations";
import type { User } from "@api/types";

interface SidebarProps {
  me: User;
}

const links = [
  { to: "/", label: "概览", exact: true },
  { to: "/students", label: "学生" },
  { to: "/jobs", label: "岗位" },
  { to: "/questions", label: "题库" },
  { to: "/materials", label: "资料" },
  { to: "/courses", label: "课程" },
] as const;

export function Sidebar({ me }: SidebarProps) {
  const logout = useLogout();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout.mutateAsync();
    navigate({ to: "/login" });
  }

  return (
    <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-divider bg-surface">
      <div className="flex items-center gap-2.5 px-5 py-5 font-heading text-lg font-semibold">
        <span className="block size-4 bg-accent" />
        <span>职寻</span>
        <span className="pt-0.5 font-body text-[10px] tracking-[0.18em] text-neutral-600">ADMIN</span>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 px-3" aria-label="主导航">
        {links.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            activeOptions={"exact" in link ? { exact: true } : undefined}
            activeProps={{ className: "bg-accent text-bg" }}
            inactiveProps={{ className: "text-text hover:bg-text/7" }}
            className="block px-3 py-2 text-sm transition-colors"
          >
            {link.label}
          </Link>
        ))}
      </nav>

      <div className="border-t border-divider px-5 py-4">
        <p className="truncate text-sm font-medium">{me.name}</p>
        <p className="mt-0.5 truncate text-xs text-neutral-600">{me.phone ?? "—"}</p>
        <button
          type="button"
          disabled={logout.isPending}
          onClick={handleLogout}
          className="mt-3 cursor-pointer text-xs text-accent-700 hover:text-accent-900 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {logout.isPending ? "正在退出…" : "退出"}
        </button>
      </div>
    </aside>
  );
}
