import { useState } from "react";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useSetMastered, useSubmitAttempt } from "@api/mutations";
import { companySetsQuery, quizDashboardQuery, quizTodayQuery } from "@api/queries";
import { QuizQuestion } from "@features/quiz-question/QuizQuestion";
import { Kicker } from "@shared/ui/Kicker";
import { AccessBanner } from "@widgets/access-banner/AccessBanner";
import { CompanySets } from "@widgets/company-sets/CompanySets";
import { Navbar } from "@widgets/navbar/Navbar";
import { PracticeSidebar } from "@widgets/practice-sidebar/PracticeSidebar";

export function PracticePage() {
  const qc = useQueryClient();
  const { data: today } = useSuspenseQuery(quizTodayQuery());
  const { data: dashboard } = useSuspenseQuery(quizDashboardQuery());
  const { data: sets } = useSuspenseQuery(companySetsQuery());
  const submit = useSubmitAttempt();
  const setMastered = useSetMastered();
  const [loadingNext, setLoadingNext] = useState(false);
  const [nextError, setNextError] = useState<Error | null>(null);
  const question = today.question;
  const result = submit.variables?.questionId === question?.id ? (submit.data ?? null) : null;

  async function nextQuestion() {
    setLoadingNext(true);
    setNextError(null);
    try {
      await qc.fetchQuery({ ...quizTodayQuery(), staleTime: 0 });
      submit.reset();
    } catch (error) {
      setNextError(error instanceof Error ? error : new Error("加载下一题失败"));
    } finally {
      setLoadingNext(false);
    }
  }

  return (
    <div className="flex min-h-full flex-col bg-bg">
      <Navbar active="practice" trailing={`连续打卡 ${dashboard.streakDays} 天`} />

      {(submit.error || setMastered.error || nextError) && (
        <p role="alert" className="px-4 py-3 text-sm text-red-700">
          {(submit.error || setMastered.error || nextError)?.message}
        </p>
      )}
      <div className="grid grid-cols-1 border-b border-divider lg:grid-cols-[minmax(0,1fr)_300px]">
        {question ? (
          <QuizQuestion
            key={question.id}
            question={question}
            date={today.date}
            indexLabel={today.indexLabel}
            result={result}
            loadingNext={loadingNext}
            submitting={submit.isPending}
            onSubmit={(picked) => submit.mutate({ questionId: question.id, picked })}
            onNext={nextQuestion}
          />
        ) : today.exhausted === "QUOTA" ? (
          <div className="px-4 py-8 sm:px-8 sm:py-9">
            <Kicker className="text-accent-700">今日一题</Kicker>
            <AccessBanner access={dashboard.access} kind="questions" className="mt-4 max-w-[720px]" />
          </div>
        ) : (
          <div className="px-4 py-8 sm:px-8 sm:py-9">
            <Kicker className="text-accent-700">今日一题</Kicker>
            <h2 className="mt-3 text-[22px] sm:text-[26px]">题库已全部答完</h2>
            <p className="mt-2 text-sm text-neutral-700">今天已答 {today.attemptedToday} 题，去错题本复习一下吧。</p>
          </div>
        )}
        <PracticeSidebar
          dashboard={dashboard}
          saving={setMastered.isPending}
          onMastered={(questionId) => setMastered.mutate({ questionId, mastered: true })}
        />
      </div>

      <CompanySets items={sets.items} />
    </div>
  );
}
