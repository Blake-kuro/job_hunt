import { Navbar } from "@widgets/navbar/Navbar";
import { PracticeSidebar } from "@widgets/practice-sidebar/PracticeSidebar";
import { CompanySets } from "@widgets/company-sets/CompanySets";
import { QuizQuestion } from "@features/quiz-question/QuizQuestion";
import { streakDays, todaysQuestion } from "@entities/quiz";

export function PracticePage() {
  return (
    <div className="flex min-h-full flex-col bg-bg">
      <Navbar active="practice" trailing={`连续打卡 ${streakDays} 天`} />

      <div className="grid grid-cols-1 border-b border-divider lg:grid-cols-[minmax(0,1fr)_300px]">
        <QuizQuestion question={todaysQuestion} />
        <PracticeSidebar />
      </div>

      <CompanySets />
    </div>
  );
}
