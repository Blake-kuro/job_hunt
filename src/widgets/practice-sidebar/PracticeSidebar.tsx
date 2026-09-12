import { Button } from "@shared/ui/Button";
import { Tag } from "@shared/ui/Tag";
import { Kicker } from "@shared/ui/Kicker";
import { cn } from "@shared/lib/cn";
import {
  categories,
  streakDays,
  totalSolved,
  weekCheckins,
  weekSolved,
  weekTarget,
  wrongList,
} from "@entities/quiz";

export function PracticeSidebar() {
  return (
    <aside className="flex flex-col gap-7 border-t border-divider px-4 py-8 sm:px-8 lg:border-l lg:border-t-0 lg:px-6 lg:py-9">
      <section>
        <Kicker className="mb-3">打卡仪表盘</Kicker>
        <div className="flex items-baseline gap-2">
          <span className="font-heading text-[44px] leading-none tabular-nums">{streakDays}</span>
          <span className="text-[13px] text-neutral-700">天连续</span>
        </div>
        <div className="mt-4 flex gap-1.5">
          {weekCheckins.map((d) => (
            <div key={d.label} className="flex flex-1 flex-col items-center gap-1.5">
              <div className={cn("h-[34px] w-full border border-divider", d.done && "bg-accent")} />
              <span className="text-[10px] tabular-nums text-neutral-700">{d.label}</span>
            </div>
          ))}
        </div>
        <div className="mt-3.5 flex justify-between text-xs text-neutral-700">
          <span>
            本周 <b className="tabular-nums">{weekSolved}</b> / {weekTarget} 题
          </span>
          <span>
            累计 <b className="tabular-nums">{totalSolved}</b> 题
          </span>
        </div>
      </section>

      <section>
        <Kicker className="mb-2.5">题库分类</Kicker>
        <ul>
          {categories.map((c) => (
            <li key={c.label}>
              <button
                type="button"
                className={cn(
                  "flex w-full cursor-pointer items-center justify-between border-b border-hairline py-2.5 text-left text-sm transition-colors hover:text-accent",
                  c.highlighted ? "text-accent-700" : "text-text",
                )}
              >
                <span>{c.label}</span>
                <span className="text-xs tabular-nums text-neutral-700">{c.count}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <Kicker className="mb-2.5">错题本 · 复习队列</Kicker>
        <ul className="flex flex-col gap-2.5">
          {wrongList.map((w) => (
            <li key={w.title} className="flex items-center justify-between gap-2.5 text-[13px]">
              <span className="truncate">{w.title}</span>
              <Tag className="text-[10px]">{w.due}</Tag>
            </li>
          ))}
        </ul>
        <Button className="mt-3 w-full">开始复习 {wrongList.length} 题</Button>
      </section>
    </aside>
  );
}
