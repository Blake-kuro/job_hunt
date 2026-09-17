import type { AdminCourse } from "@job-hunt/api-client/types";
import { Badge } from "@job-hunt/ui/components/badge";
import { type Column, DataTable } from "@job-hunt/ui/components/data-table";
import { useSuspenseQuery } from "@tanstack/react-query";
import { coursesQuery } from "@api/queries";

const price = (cents: number) => (cents === 0 ? "免费" : `¥${(cents / 100).toFixed(2)}`);

const columns: Column<AdminCourse>[] = [
  {
    id: "title",
    header: "标题",
    cell: (c) => (
      <div className="max-w-[360px]">
        <div className="truncate font-medium" title={c.title}>
          {c.title}
        </div>
        {c.summary && (
          <div className="truncate text-xs text-neutral-600" title={c.summary}>
            {c.summary}
          </div>
        )}
      </div>
    ),
  },
  { id: "teacher", header: "讲师", cell: (c) => <span className="text-neutral-700">{c.teacher ?? "—"}</span> },
  {
    id: "price",
    header: "价格",
    cell: (c) => <span className="text-neutral-700 tabular-nums">{price(c.priceCents)}</span>,
  },
  {
    id: "lessons",
    header: "课时 / 就绪",
    cell: (c) => (
      <span className="text-neutral-700 tabular-nums">
        {c.lessonCount} / {c.readyCount}
      </span>
    ),
  },
  {
    id: "grants",
    header: "已开通",
    cell: (c) => <span className="text-neutral-700 tabular-nums">{c.grantCount}</span>,
  },
  { id: "published", header: "状态", cell: (c) => <Badge>{c.published ? "已发布" : "未发布"}</Badge> },
  {
    id: "updatedAt",
    header: "更新时间",
    cell: (c) => (
      <span className="text-neutral-700 tabular-nums">{new Date(c.updatedAt).toLocaleDateString("zh-CN")}</span>
    ),
  },
];

/** 过渡期只读列表：课程结构 / 视频上传 / 按课授权的编辑页在网课管理端任务里重做 */
export function CoursesPage() {
  const { data } = useSuspenseQuery(coursesQuery());

  return (
    <>
      <h1 className="text-3xl">课程</h1>
      <p className="mt-2 text-sm text-neutral-700">
        网课（课程 → 章 → 课时，视频存腾讯云 VOD）；免费课学生可直接看，付费课需按课开通。编辑页即将上线。
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <span className="text-sm text-neutral-700 tabular-nums">共 {data.length} 门</span>
      </div>

      <div className="mt-6 pb-6">
        <DataTable
          columns={columns}
          rows={data}
          rowKey={(c) => c.id}
          caption="课程列表"
          layout="auto"
          nowrap
          flush
          emptyMessage="还没有课程"
        />
      </div>
    </>
  );
}
