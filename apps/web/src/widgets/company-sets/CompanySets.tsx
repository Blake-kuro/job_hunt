import { BlueprintCard } from "@shared/ui/BlueprintCard";
import type { CompanySetItem } from "@entities/quiz";

export function CompanySets({ items }: { items: CompanySetItem[] }) {
  return (
    <section className="px-4 pb-9 pt-7 sm:px-8">
      <div className="flex flex-wrap items-baseline gap-x-3.5 gap-y-1">
        <h4 className="text-xl">按公司真题分组</h4>
        <span className="text-[13px] text-neutral-700">整理自往年面经与在招岗位的考点分布</span>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {items.map((s) => (
          <BlueprintCard key={s.id} className="p-[18px]">
            <p className="text-[10px] uppercase tracking-[0.1em] text-accent">{s.track}</p>
            <p className="mt-2 font-heading text-xl leading-tight">{s.company}</p>
            <p className="mt-2 text-[13px] leading-relaxed text-neutral-700">{s.focus}</p>
            <div className="mt-4 flex items-center justify-between border-t border-divider pt-3 text-xs">
              <span className="tabular-nums text-neutral-700">{s.count} 题</span>
              <span className="text-accent-700">已收录</span>
            </div>
          </BlueprintCard>
        ))}
      </div>
    </section>
  );
}
