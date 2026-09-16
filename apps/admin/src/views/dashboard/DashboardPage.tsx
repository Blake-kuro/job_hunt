import { useSuspenseQuery } from "@tanstack/react-query";
import { summaryQuery } from "@api/queries";
import { StatCard } from "@shared/ui/StatCard";

export function DashboardPage() {
  const { data: s } = useSuspenseQuery(summaryQuery());
  return (
    <>
      <h1 className="text-3xl">概览</h1>
      <p className="mt-2 text-sm text-neutral-700">各模块的当前数量，点击卡片进入对应管理页。</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="学生" value={s.students} hint="有手机号的注册用户" to="/students" />
        <StatCard label="PRO 学生" value={s.proStudents} to="/students" search={{ plan: "PRO" }} />
        <StatCard label="已启用" value={s.enabledStudents} hint="未被停用的学生" />
        <StatCard label="游客" value={s.guests} hint="未绑定手机号的会话" />
        <StatCard label="岗位" value={s.jobs} to="/jobs" />
        <StatCard label="公司" value={s.companies} hint="题库按公司划分" to="/questions" />
        <StatCard label="题目" value={s.questions} to="/questions" />
        <StatCard label="已发布题目" value={s.publishedQuestions} to="/questions" />
        <StatCard label="资料" value={s.materials} to="/materials" />
        <StatCard label="课程" value={s.courses} to="/courses" />
      </div>
    </>
  );
}
