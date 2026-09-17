import { StatCard } from "@job-hunt/ui/components/stat-card";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, type LinkOptions } from "@tanstack/react-router";
import { summaryQuery } from "@api/queries";

interface LinkedStatProps {
  label: string;
  value: number;
  hint?: string;
  to: LinkOptions["to"];
  search?: LinkOptions["search"];
}

/** 整卡可点击的概览卡：包 StatCard 不含链接，外层包 Link，hover 高亮加在卡片上 */
function LinkedStat({ label, value, hint, to, search }: LinkedStatProps) {
  return (
    <Link to={to} search={search} className="block">
      <StatCard
        label={label}
        value={value}
        hint={hint}
        className="transition-colors hover:border-accent hover:bg-accent-100"
      />
    </Link>
  );
}

export function DashboardPage() {
  const { data: s } = useSuspenseQuery(summaryQuery());
  return (
    <>
      <h1 className="text-3xl">概览</h1>
      <p className="mt-2 text-sm text-neutral-700">各模块的当前数量，点击卡片进入对应管理页。</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <LinkedStat label="学生" value={s.students} hint="有手机号的注册用户" to="/students" />
        <LinkedStat label="PRO 学生" value={s.proStudents} to="/students" search={{ plan: "PRO" }} />
        <StatCard label="已启用" value={s.enabledStudents} hint="未被停用的学生" />
        <StatCard label="游客" value={s.guests} hint="未绑定手机号的会话" />
        <LinkedStat label="岗位" value={s.jobs} to="/jobs" />
        <LinkedStat label="公司" value={s.companies} hint="题库按公司划分" to="/questions" />
        <LinkedStat label="题目" value={s.questions} to="/questions" />
        <LinkedStat label="已发布题目" value={s.publishedQuestions} to="/questions" />
        <LinkedStat label="资料" value={s.materials} to="/materials" />
        <LinkedStat label="课程" value={s.courses} to="/courses" />
        <StatCard label="就绪课时" value={s.readyLessons} hint="视频已转码可播放的课时" />
        <LinkedStat label="按课开通" value={s.courseGrants} hint="课程授权记录数（含已过期）" to="/students" />
      </div>
    </>
  );
}
