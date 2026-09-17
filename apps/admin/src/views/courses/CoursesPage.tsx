import type { AdminCourse } from "@job-hunt/api-client/types";
import { Badge } from "@job-hunt/ui/components/badge";
import { Button } from "@job-hunt/ui/components/button";
import { type Column, DataTable } from "@job-hunt/ui/components/data-table";
import { Input } from "@job-hunt/ui/components/input";
import { Pagination } from "@job-hunt/ui/components/pagination";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@job-hunt/ui/components/select";
import { useDebouncedSearch } from "@job-hunt/ui/hooks/use-debounced-search";
import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { useDeleteCourse } from "@api/mutations";
import { adminCoursesQuery } from "@api/queries";
import { CourseDialog } from "./CourseDialog";
import { formatPrice } from "./format";

const route = getRouteApi("/_admin/courses");

/** Radix Select 的项不能是空串：筛选里的「全部」用这个哨兵值 */
const ALL = "all";

interface RowActions {
  deletingId?: string;
  onDelete: (c: AdminCourse) => void;
}

const buildColumns = (a: RowActions): Column<AdminCourse>[] => [
  {
    id: "title",
    header: "标题",
    cell: (c) => (
      <div className="max-w-[360px]">
        <Link
          to="/courses/$courseId"
          params={{ courseId: c.id }}
          className="block truncate font-medium text-accent underline-offset-2 hover:underline"
          title={c.title}
        >
          {c.title}
        </Link>
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
    cell: (c) => <span className="text-neutral-700 tabular-nums">{formatPrice(c.priceCents)}</span>,
  },
  {
    id: "published",
    header: "已发布",
    cell: (c) => <Badge variant={c.published ? "accent" : "neutral"}>{c.published ? "已发布" : "未发布"}</Badge>,
  },
  {
    id: "lessons",
    header: "课时（就绪）",
    cell: (c) => (
      <span className="text-neutral-700 tabular-nums">
        {c.lessonCount}（{c.readyCount}）
      </span>
    ),
  },
  {
    id: "grants",
    header: "已开通",
    cell: (c) => <span className="text-neutral-700 tabular-nums">{c.grantCount}</span>,
  },
  {
    id: "actions",
    header: "操作",
    cell: (c) => {
      const deleting = a.deletingId === c.id;
      return (
        <div className="flex gap-1.5">
          <Button size="sm" asChild>
            <Link to="/courses/$courseId" params={{ courseId: c.id }}>
              详情
            </Link>
          </Button>
          <Button size="sm" disabled={deleting} onClick={() => a.onDelete(c)}>
            {deleting ? "删除中…" : "删除"}
          </Button>
        </div>
      );
    },
  },
];

export function CoursesPage() {
  const search = route.useSearch();
  const navigate = route.useNavigate();
  const { data } = useSuspenseQuery(adminCoursesQuery(search));
  const remove = useDeleteCourse();
  const [creating, setCreating] = useState(false);

  // 搜索框本地缓冲 + 300ms 防抖，避免每个字符都改 URL
  const commitQuery = useCallback(
    (q: string) => navigate({ search: (s) => ({ ...s, q: q || undefined, page: 1 }) }),
    [navigate],
  );
  const [draft, setDraft] = useDebouncedSearch(search.q ?? "", commitQuery);

  function confirmDelete(c: AdminCourse) {
    if (
      !window.confirm(
        `删除课程「${c.title}」？章、课时、学习进度与按课授权（${c.grantCount} 人）会一并删除，VOD 上的视频不会删除`,
      )
    )
      return;
    remove.mutate(c.id);
  }
  const deletingId = remove.isPending ? remove.variables : undefined;

  const columns = buildColumns({ deletingId, onDelete: confirmDelete });

  return (
    <>
      <h1 className="text-3xl">课程</h1>
      <p className="mt-2 text-sm text-neutral-700">
        网课（课程 → 章 → 课时，视频存腾讯云
        VOD）；免费课学生可直接看，付费课需按课开通。进入详情编辑结构、上传视频、开通学员。
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Input
          type="search"
          aria-label="搜索课程"
          placeholder="搜索标题或讲师"
          className="sm:w-[260px]"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <Select
          value={search.published === undefined ? ALL : String(search.published)}
          onValueChange={(v) => {
            const published = v === ALL ? undefined : v === "true";
            navigate({ search: (s) => ({ ...s, published, page: 1 }) });
          }}
        >
          <SelectTrigger aria-label="状态" className="sm:w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>全部状态</SelectItem>
            <SelectItem value="true">已发布</SelectItem>
            <SelectItem value="false">未发布</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-neutral-700 tabular-nums">共 {data.total} 门</span>
        <div className="ml-auto">
          <Button variant="primary" onClick={() => setCreating(true)}>
            新建课程
          </Button>
        </div>
      </div>

      {remove.error && (
        <p role="alert" className="mt-3 text-xs text-red-700">
          删除失败：{remove.error.message}
        </p>
      )}

      <div className="mt-6 pb-6">
        <DataTable
          columns={columns}
          rows={data.items}
          rowKey={(c) => c.id}
          caption="课程列表"
          layout="auto"
          nowrap
          flush
          emptyMessage={search.q || search.published !== undefined ? "没有符合条件的课程" : "还没有课程"}
        />
      </div>

      <Pagination
        page={data.page}
        pageSize={data.pageSize}
        total={data.total}
        onChange={(page) => navigate({ search: (s) => ({ ...s, page }) })}
      />

      <CourseDialog
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(id) => navigate({ to: "/courses/$courseId", params: { courseId: id } })}
      />
    </>
  );
}
