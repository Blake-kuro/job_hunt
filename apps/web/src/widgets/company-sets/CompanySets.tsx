import { BlueprintCard } from "@shared/ui/BlueprintCard";
import type { QuizBanks } from "@api/types";

export function CompanySets({
  items,
  selected,
  onSelect,
}: {
  items: QuizBanks["companies"];
  selected: string;
  onSelect: (id: string) => void;
}) {
  return (
    <section className="px-4 pb-9 pt-7 sm:px-8">
      <h1 className="text-2xl">公司题库</h1>
      {!items.length && <p className="mt-4">暂无可见题库，请联系管理员开通权限。</p>}
      <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {items.map((co) => (
          <BlueprintCard key={co.id} className="p-[18px]">
            <h2 className="font-heading text-xl">{co.name}</h2>
            {co.categories.map((c) => (
              <button
                key={c.id}
                type="button"
                aria-pressed={selected === c.id}
                onClick={() => onSelect(c.id)}
                className="mt-3 block w-full border border-divider p-3 text-left hover:bg-accent-100 aria-pressed:bg-accent-100"
              >
                <span className="block">{c.name}</span>
                <span className="text-xs text-neutral-700">
                  已答 {c.answered} / {c.total} · 正确 {c.correct}
                </span>
              </button>
            ))}
          </BlueprintCard>
        ))}
      </div>
    </section>
  );
}
