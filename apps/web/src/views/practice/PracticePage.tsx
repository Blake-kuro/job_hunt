import { useState } from "react";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useSetMastered, useSubmitAttempt } from "@api/mutations";
import { quizBanksQuery, quizDashboardQuery, quizNextQuery } from "@api/queries";
import { QuizQuestion } from "@features/quiz-question/QuizQuestion";
import { CompanySets } from "@widgets/company-sets/CompanySets";
import { Navbar } from "@widgets/navbar/Navbar";
import { PracticeSidebar } from "@widgets/practice-sidebar/PracticeSidebar";

export function PracticePage() {
  const { data: dashboard } = useSuspenseQuery(quizDashboardQuery());
  const { data: banks } = useSuspenseQuery(quizBanksQuery());
  const [categoryId, setCategoryId] = useState("");
  const setMastered = useSetMastered();
  const selected = banks.companies.some((co) => co.categories.some((c) => c.id === categoryId));
  return (
    <div className="flex min-h-full flex-col bg-bg">
      <Navbar active="practice" trailing={`连续打卡 ${dashboard.streakDays} 天`} />
      <CompanySets items={banks.companies} selected={categoryId} onSelect={setCategoryId} />
      <p className="px-8 pb-4 text-sm text-neutral-700">
        累计作答 {banks.quota.used} / {banks.quota.limit ?? "不限"} 题（非每日额度）
      </p>
      <div className="grid grid-cols-1 border-y border-divider lg:grid-cols-[minmax(0,1fr)_300px]">
        {selected ? (
          <CategoryPractice key={categoryId} categoryId={categoryId} />
        ) : (
          <p className="p-8">请选择公司下的分类开始练习。</p>
        )}
        <div>
          {setMastered.error && <p role="alert">{setMastered.error.message}</p>}
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

function CategoryPractice({ categoryId }: { categoryId: string }) {
  const next = useQuery({ ...quizNextQuery(categoryId), refetchOnMount: "always" });
  const submit = useSubmitAttempt();
  const question = next.data?.question;
  if (next.isPending) return <p className="p-8">正在加载题目…</p>;
  if (next.isError)
    return (
      <div className="p-8" role="alert">
        {next.error.message}
        <button type="button" onClick={() => next.refetch()}>
          重试
        </button>
      </div>
    );
  if (!question)
    return (
      <div className="p-8">
        <h2 className="text-xl">{next.data.exhausted === "QUOTA" ? "累计作答额度已用完" : "该分类已全部答完"}</h2>
        <p className="mt-3">
          {next.data.exhausted === "QUOTA"
            ? "请登录提升额度，或联系管理员开通权限；额度不会每天重置。"
            : "可以选择其他分类继续练习。"}
        </p>
      </div>
    );
  return (
    <div>
      {submit.error && (
        <p role="alert" className="p-4 text-red-700">
          {submit.error.message}
        </p>
      )}
      <QuizQuestion
        key={question.id}
        question={question}
        date={new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Shanghai" })}
        indexLabel={`${next.data.category.company} · ${next.data.index} / ${next.data.category.total}`}
        result={submit.variables?.questionId === question.id ? (submit.data ?? null) : null}
        submitting={submit.isPending}
        loadingNext={next.isFetching}
        onSubmit={(picked) => submit.mutate({ questionId: question.id, picked })}
        onNext={async () => {
          const result = await next.refetch();
          if (!result.isError) submit.reset();
        }}
      />
    </div>
  );
}
