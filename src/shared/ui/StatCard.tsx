import { Link, type LinkOptions } from "@tanstack/react-router";
import { cn } from "@shared/lib/cn";
import { Kicker } from "./Kicker";

interface StatCardProps {
  label: string;
  value: number | string;
  hint?: string;
  /** 存在时整卡可点击跳转 */
  to?: LinkOptions["to"];
  search?: LinkOptions["search"];
}

const base = "block border border-divider bg-surface px-5 py-4";

export function StatCard({ label, value, hint, to, search }: StatCardProps) {
  const body = (
    <>
      <Kicker className="text-neutral-700">{label}</Kicker>
      <p className="mt-2 font-heading text-4xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-neutral-600">{hint}</p>}
    </>
  );
  if (to) {
    return (
      <Link to={to} search={search} className={cn(base, "transition-colors hover:border-accent hover:bg-accent-100")}>
        {body}
      </Link>
    );
  }
  return <div className={base}>{body}</div>;
}
