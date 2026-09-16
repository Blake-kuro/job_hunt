import { Tag } from "@shared/ui/Tag";
import { Kicker } from "@shared/ui/Kicker";
import { cn } from "@shared/lib/cn";
import type { QuizDashboard } from "@entities/quiz";

export function PracticeSidebar({
  dashboard,
  onMastered,
  saving,
}: {
  dashboard: QuizDashboard;
  onMastered: (questionId: string) => void;
  saving: boolean;
}) {
  const { streakDays, week, weekSolved, weekTarget, totalSolved, wrongList } = dashboard;
  return (
    <aside className="flex flex-col gap-7 border-t border-divider px-4 py-8 sm:px-8 lg:border-l lg:border-t-0 lg:px-6 lg:py-9">
      <section>
        <Kicker className="mb-3">打卡仪表盘</Kicker>
        <div className="flex items-baseline gap-2">
          <span className="font-heading text-[44px] leading-none tabular-nums">{streakDays}</span>
          <span className="text-[13px] text-neutral-700">天连续</span>
        </div>
        <div className="mt-4 flex gap-1.5">
          {week.map((d) => (
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
        <Kicker className="mb-2.5">错题本 · 复习队列</Kicker>
        <ul className="flex flex-col gap-2.5">
          {wrongList.map((w) => (
            <li key={w.questionId} className="flex items-center justify-between gap-2.5 text-[13px]">
              <span className="truncate">{w.title}</span>
              <span className="flex shrink-0 items-center gap-1.5">
                <Tag className="text-[10px]">{w.due}</Tag>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => onMastered(w.questionId)}
                  className="cursor-pointer text-[11px] text-accent-700 hover:text-accent-900 disabled:opacity-50"
                >
                  已掌握
                </button>
              </span>
            </li>
          ))}
        </ul>
        {wrongList.length === 0 && <p className="text-[13px] text-neutral-700">暂无错题</p>}
      </section>
    </aside>
  );
}
