import type { AdminStudent, Plan } from "@job-hunt/api-client/types";
import { Badge } from "@job-hunt/ui/components/badge";
import { Button } from "@job-hunt/ui/components/button";
import { type Column, DataTable } from "@job-hunt/ui/components/data-table";
import { Input } from "@job-hunt/ui/components/input";
import { Pagination } from "@job-hunt/ui/components/pagination";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@job-hunt/ui/components/select";
import { useDebouncedSearch } from "@job-hunt/ui/hooks/use-debounced-search";
import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { usePatchStudent } from "@api/mutations";
import { studentsQuery } from "@api/queries";
import { GrantsDialog } from "./GrantsDialog";
import { PlanDialog } from "./PlanDialog";

const route = getRouteApi("/_admin/students");

const tierLabel: Record<AdminStudent["tier"], string> = { GUEST: "游客", FREE: "免费", PRO: "PRO" };

/** Radix Select 的项不能是空串：筛选里的「全部」用这个哨兵值 */
const ALL = "all";

interface RowActions {
  togglingId?: string;
  onToggleEnabled: (s: AdminStudent) => void;
  onPlan: (s: AdminStudent) => void;
  onGrants: (s: AdminStudent) => void;
}

const buildColumns = (a: RowActions): Column<AdminStudent>[] => [
  {
    id: "student",
    header: "学生",
    cell: (s) => (
      <>
        <div className="font-medium">{s.name}</div>
        <div className="text-xs text-neutral-600 tabular-nums">{s.phone ?? "—"}</div>
      </>
    ),
  },
  {
    id: "role",
    header: "角色",
    cell: (s) =>
      s.role === "ADMIN" ? <Badge className="bg-accent text-bg">管理员</Badge> : <Badge variant="neutral">学生</Badge>,
  },
  {
    id: "tier",
    header: "档位",
    cell: (s) => (
      <>
        <div>{tierLabel[s.tier]}</div>
        {s.tier === "PRO" && s.proExpiresAt && (
          <div className="text-xs text-neutral-600 tabular-nums">到 {s.proExpiresAt.slice(0, 10)}</div>
        )}
      </>
    ),
  },
  {
    id: "enabled",
    header: "状态",
    cell: (s) => <Badge variant={s.enabled ? "accent" : "outline"}>{s.enabled ? "启用" : "停用"}</Badge>,
  },
  {
    id: "stats",
    header: "数据",
    cell: (s) => (
      <span className="text-neutral-700 tabular-nums">
        收藏 {s.stats.favorites} · 投递 {s.stats.applications} · 作答 {s.stats.attempts}
      </span>
    ),
  },
  {
    id: "createdAt",
    header: "注册时间",
    cell: (s) => (
      <span className="text-neutral-700 tabular-nums">{new Date(s.createdAt).toLocaleDateString("zh-CN")}</span>
    ),
  },
  {
    id: "actions",
    header: "操作",
    cell: (s) => {
      const isAdmin = s.role === "ADMIN";
      const busy = a.togglingId === s.id;
      return (
        <div className="flex gap-1.5">
          <Button size="sm" disabled={isAdmin || busy} onClick={() => a.onToggleEnabled(s)}>
            {s.enabled ? "停用" : "启用"}
          </Button>
          <Button size="sm" disabled={isAdmin} onClick={() => a.onPlan(s)}>
            档位
          </Button>
          <Button size="sm" disabled={isAdmin} onClick={() => a.onGrants(s)}>
            授权 ({s.grants.length})
          </Button>
        </div>
      );
    },
  },
];

export function StudentsPage() {
  const search = route.useSearch();
  const navigate = route.useNavigate();
  const { data } = useSuspenseQuery(studentsQuery(search));
  const patch = usePatchStudent();
  const [planTarget, setPlanTarget] = useState<AdminStudent | null>(null);
  const [grantsTarget, setGrantsTarget] = useState<AdminStudent | null>(null);

  // 搜索框本地缓冲 + 300ms 防抖，避免每个字符都改 URL
  const commitQuery = useCallback(
    (q: string) => navigate({ search: (s) => ({ ...s, q: q || undefined, page: 1 }) }),
    [navigate],
  );
  const [draft, setDraft] = useDebouncedSearch(search.q ?? "", commitQuery);

  function toggleEnabled(s: AdminStudent) {
    patch.mutate({ id: s.id, body: { enabled: !s.enabled } });
  }
  const togglingId = patch.isPending ? patch.variables?.id : undefined;

  const columns = buildColumns({
    togglingId,
    onToggleEnabled: toggleEnabled,
    onPlan: setPlanTarget,
    onGrants: setGrantsTarget,
  });

  return (
    <>
      <h1 className="text-3xl">学生</h1>
      <p className="mt-2 text-sm text-neutral-700">有手机号的注册用户；可停用账号、调整档位或单独授权内容。</p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Input
          type="search"
          aria-label="搜索学生"
          placeholder="搜索姓名或手机号"
          className="sm:w-[260px]"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <Select
          value={search.plan ?? ALL}
          onValueChange={(v) => {
            const plan = v === ALL ? undefined : (v as Plan);
            navigate({ search: (s) => ({ ...s, plan, page: 1 }) });
          }}
        >
          <SelectTrigger aria-label="档位" className="sm:w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>全部档位</SelectItem>
            <SelectItem value="FREE">FREE</SelectItem>
            <SelectItem value="PRO">PRO</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={search.enabled === undefined ? ALL : String(search.enabled)}
          onValueChange={(v) => {
            const enabled = v === ALL ? undefined : v === "true";
            navigate({ search: (s) => ({ ...s, enabled, page: 1 }) });
          }}
        >
          <SelectTrigger aria-label="状态" className="sm:w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>全部状态</SelectItem>
            <SelectItem value="true">启用</SelectItem>
            <SelectItem value="false">停用</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {patch.error && (
        <p role="alert" className="mt-3 text-xs text-red-700">
          操作失败：{patch.error.message}
        </p>
      )}

      <div className="mt-6 pb-6">
        <DataTable
          columns={columns}
          rows={data.items}
          rowKey={(s) => s.id}
          caption="学生列表"
          layout="auto"
          nowrap
          flush
          emptyMessage="没有符合条件的学生"
        />
      </div>

      <Pagination
        page={data.page}
        pageSize={data.pageSize}
        total={data.total}
        onChange={(page) => navigate({ search: (s) => ({ ...s, page }) })}
      />

      <PlanDialog student={planTarget} onClose={() => setPlanTarget(null)} />
      <GrantsDialog student={grantsTarget} onClose={() => setGrantsTarget(null)} />
    </>
  );
}
