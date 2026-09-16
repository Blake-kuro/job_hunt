import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import { useSetMastered, useSubmitAttempt } from "@api/mutations";
import { quizDashboardQuery, quizNextQuery } from "@api/queries";
import { QuizQuestion } from "@features/quiz-question/QuizQuestion";
import { Button } from "@shared/ui/Button";
import { Kicker } from "@shared/ui/Kicker";
import { AccessBanner } from "@widgets/access-banner/AccessBanner";
import { Navbar } from "@widgets/navbar/Navbar";
import { PracticeSidebar } from "@widgets/practice-sidebar/PracticeSidebar";

const route = getRouteApi("/practice_/$categoryId");

export function PracticePage() {
  const { categoryId } = route.useParams();
  const qc = useQueryClient();
  const { data: dashboard } = useSuspenseQuery(quizDashboardQuery());
  const next = useQuery(quizNextQuery(categoryId));
  const submit = useSubmitAttempt();
  const setMastered = useSetMastered();

  async function loadNext() {
    try {
      await qc.fetchQuery({ ...quizNextQuery(categoryId), staleTime: 0 });
      submit.reset();
    } catch {
      // 失败时保留当前题与解析，useQuery 会展示错误并提供重试。
    }
  }

  return (
    <div className="flex min-h-full flex-col bg-bg">
      <Navbar active="practice" trailing={`连续打卡 ${dashboard.streakDays} 天`} />
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px]">
        <main>
          {next.isPending ? (
            <p className="px-4 py-8 text-sm text-neutral-700 sm:px-8 sm:py-9">正在加载题目…</p>
          ) : next.isError ? (
            <div role="alert" className="flex flex-col items-start gap-3 px-4 py-8 sm:px-8 sm:py-9">
              <p className="font-heading text-xl">题目加载失败</p>
              <p className="text-sm text-neutral-700">{next.error.message}</p>
              <Button onClick={() => next.refetch()}>重试</Button>
              <Link to="/practice" className="text-sm text-accent-700 hover:text-accent-900">
                返回题库
              </Link>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2 border-b border-divider px-4 py-3 text-sm sm:px-8">
                <Link to="/practice" className="text-accent-700 hover:text-accent-900">
                  题库
                </Link>
                <span className="text-neutral-600">›</span>
                <span>
                  {next.data.category.company} · {next.data.category.name}
                </span>
              </div>
              {next.data.question ? (
                <>
                  {submit.error && (
                    <p role="alert" className="px-4 pt-4 text-sm text-red-700 sm:px-8">
                      {submit.error.message}
                    </p>
                  )}
                  <QuizQuestion
                    key={next.data.question.id}
                    question={next.data.question}
                    indexLabel={`第 ${next.data.index} / ${next.data.category.total} 题`}
                    result={submit.variables?.questionId === next.data.question.id ? (submit.data ?? null) : null}
                    submitting={submit.isPending}
                    loadingNext={next.isFetching}
                    onSubmit={(picked) => submit.mutate({ questionId: next.data.question?.id ?? "", picked })}
                    onNext={loadNext}
                  />
                </>
              ) : next.data.exhausted === "QUOTA" ? (
                <div className="px-4 py-8 sm:px-8 sm:py-9">
                  <Kicker className="mb-3 text-accent-700">作答额度已用完</Kicker>
                  <AccessBanner kind="questions" quota={dashboard.quota} />
                  <Link to="/practice" className="mt-4 inline-block text-sm text-accent-700 hover:text-accent-900">
                    返回题库
                  </Link>
                </div>
              ) : (
                <div className="flex flex-col items-start gap-3 px-4 py-8 sm:px-8 sm:py-9">
                  <Kicker className="text-accent-700">已完成</Kicker>
                  <p className="font-heading text-2xl">本题库已全部答完</p>
                  <p className="text-sm text-neutral-700">
                    共 {next.data.category.total} 题，可以回到题库选择其他分类继续练习。
                  </p>
                  <Link to="/practice" className="text-sm text-accent-700 hover:text-accent-900">
                    返回题库 →
                  </Link>
                </div>
              )}
            </>
          )}
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
