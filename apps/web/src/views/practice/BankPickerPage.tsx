import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useSetMastered } from "@api/mutations";
import { quizBanksQuery, quizDashboardQuery } from "@api/queries";
import type { QuizBanks } from "@entities/quiz";
import { cn } from "@shared/lib/cn";
import { Kicker } from "@shared/ui/Kicker";
import { AccessBanner } from "@widgets/access-banner/AccessBanner";
import { Navbar } from "@widgets/navbar/Navbar";
import { PracticeSidebar } from "@widgets/practice-sidebar/PracticeSidebar";

type Category = QuizBanks["companies"][number]["categories"][number];

/** 与 Button secondary / primary md 的类名保持一致（Button 不支持 asChild，Link 手动套用） */
const linkButtonBase =
  "inline-flex shrink-0 items-center justify-center whitespace-nowrap border px-3 py-1.5 font-heading text-[13px] font-semibold leading-tight transition-colors";
const linkButtonClass = {
  primary: cn(
    linkButtonBase,
    "cursor-pointer border-accent bg-accent text-bg hover:bg-accent-600 active:bg-accent-700",
  ),
  secondary: cn(linkButtonBase, "cursor-pointer border-divider hover:bg-text/7 active:bg-text/15"),
  disabled: cn(linkButtonBase, "cursor-not-allowed border-divider opacity-45"),
};

function CategoryRow({ category }: { category: Category }) {
  const { id, name, total, answered, correct } = category;
  const percent = total === 0 ? 0 : Math.round((Math.min(answered, total) / total) * 100);
  const state = total === 0 ? "empty" : answered === 0 ? "start" : answered < total ? "continue" : "done";
  return (
    <li className="grid grid-cols-1 items-center gap-x-6 gap-y-3 border-t border-divider py-4 first:border-t-0 sm:grid-cols-[minmax(0,1fr)_auto]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-[15px] font-medium">{name}</span>
          <span className="text-xs tabular-nums text-neutral-700">
            已答 {answered} / {total} · 答对 {correct}
          </span>
        </div>
        <div className="mt-2.5 h-1.5 w-full max-w-[420px] bg-neutral-100">
          <div className="h-full bg-accent transition-[width]" style={{ width: `${percent}%` }} />
        </div>
      </div>
      {state === "empty" ? (
        <span aria-disabled="true" className={linkButtonClass.disabled}>
          暂无题目
        </span>
      ) : (
        <Link
          to="/practice/$categoryId"
          params={{ categoryId: id }}
          className={state === "done" ? linkButtonClass.secondary : linkButtonClass.primary}
        >
          {state === "start" ? "开始" : state === "continue" ? "继续" : "已完成"}
        </Link>
      )}
    </li>
  );
}

export function BankPickerPage() {
  const { data: banks } = useSuspenseQuery(quizBanksQuery());
  const { data: dashboard } = useSuspenseQuery(quizDashboardQuery());
  const setMastered = useSetMastered();
  const { quota } = banks;

  return (
    <div className="flex min-h-full flex-col bg-bg">
      <Navbar active="practice" trailing={`连续打卡 ${dashboard.streakDays} 天`} />
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px]">
        <main className="px-4 py-8 sm:px-8 sm:py-9">
          <AccessBanner kind="questions" quota={quota} className="mb-6" />
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <Kicker className="mb-2 text-accent-700">题库</Kicker>
              <h1 className="text-[28px] leading-tight sm:text-[36px]">选择公司与分类，按顺序刷题</h1>
            </div>
            <span className="text-xs tabular-nums text-neutral-700">
              累计作答 {quota.used} / {quota.limit ?? "不限"} 题
            </span>
          </div>

          {banks.companies.length === 0 && <p className="mt-8 text-sm text-neutral-700">暂无题库，敬请期待。</p>}

          <div className="mt-8 flex flex-col gap-9">
            {banks.companies.map((company) => (
              <section key={company.id}>
                <Kicker className="mb-1 text-accent-700">{company.name}</Kicker>
                <ul className="border-b border-divider">
                  {company.categories.map((c) => (
                    <CategoryRow key={c.id} category={c} />
                  ))}
                </ul>
                {company.categories.length === 0 && <p className="py-3 text-sm text-neutral-700">暂无分类</p>}
              </section>
            ))}
          </div>
        </main>
        <div>
          {setMastered.error && (
            <p role="alert" className="px-4 pt-4 text-sm text-red-700 sm:px-8 lg:px-6">
              {setMastered.error.message}
            </p>
          )}
          <PracticeSidebar
            dashboard={dashboard}
            saving={setMastered.isPending}
            onMastered={(questionId) => setMastered.mutate({ questionId, mastered: true })}
          />
        </div>
      </div>
    </div>
  );
}
