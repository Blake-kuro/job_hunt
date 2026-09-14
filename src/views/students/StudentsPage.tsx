import { useEffect, useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { usePatchStudent } from "@api/mutations";
import { studentsQuery } from "@api/queries";
import type { AdminStudent, Plan } from "@api/types";
import { Button } from "@shared/ui/Button";
import { Input } from "@shared/ui/Input";
import { Pagination } from "@shared/ui/Pagination";
import { Select } from "@shared/ui/Select";
import { Tag } from "@shared/ui/Tag";
import { GrantsDialog } from "./GrantsDialog";
import { PlanDialog } from "./PlanDialog";

const route = getRouteApi("/_admin/students");

const tierLabel: Record<AdminStudent["tier"], string> = { GUEST: "游客", FREE: "免费", PRO: "PRO" };

const th = "px-3 py-2 text-left text-[11px] font-medium uppercase tracking-[0.08em] text-neutral-700";
const td = "px-3 py-2.5 align-top whitespace-nowrap";

export function StudentsPage() {
  const search = route.useSearch();
  const navigate = route.useNavigate();
  const { data } = useSuspenseQuery(studentsQuery(search));
  const patch = usePatchStudent();
  const [planTarget, setPlanTarget] = useState<AdminStudent | null>(null);
  const [grantsTarget, setGrantsTarget] = useState<AdminStudent | null>(null);

  // 搜索框本地缓冲 + 300ms 防抖，避免每个字符都改 URL
  const query = search.q ?? "";
  const [draft, setDraft] = useState(query);
  const [prevQuery, setPrevQuery] = useState(query);
  if (query !== prevQuery) {
    setPrevQuery(query);
    setDraft(query);
  }
  useEffect(() => {
    const normalized = draft.trim();
    if (normalized === query) return;
    const t = setTimeout(() => navigate({ search: (s) => ({ ...s, q: normalized || undefined, page: 1 }) }), 300);
    return () => clearTimeout(t);
  }, [draft, query, navigate]);

  function toggleEnabled(s: AdminStudent) {
    patch.mutate({ id: s.id, body: { enabled: !s.enabled } });
  }
  const togglingId = patch.isPending ? patch.variables?.id : undefined;

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
          aria-label="档位"
          className="min-h-9 sm:w-[140px]"
          value={search.plan ?? ""}
          onChange={(e) => {
            const plan = (e.target.value || undefined) as Plan | undefined;
            navigate({ search: (s) => ({ ...s, plan, page: 1 }) });
          }}
        >
          <option value="">全部档位</option>
          <option value="FREE">FREE</option>
          <option value="PRO">PRO</option>
        </Select>
        <Select
          aria-label="状态"
          className="min-h-9 sm:w-[140px]"
          value={search.enabled ?? ""}
          onChange={(e) => {
            const enabled = (e.target.value || undefined) as "true" | "false" | undefined;
            navigate({ search: (s) => ({ ...s, enabled, page: 1 }) });
          }}
        >
          <option value="">全部状态</option>
          <option value="true">启用</option>
          <option value="false">停用</option>
        </Select>
      </div>

      {patch.error && (
        <p role="alert" className="mt-3 text-xs text-red-700">
          操作失败：{patch.error.message}
        </p>
      )}

      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-divider">
              <th className={th}>学生</th>
              <th className={th}>角色</th>
              <th className={th}>档位</th>
              <th className={th}>状态</th>
              <th className={th}>数据</th>
              <th className={th}>注册时间</th>
              <th className={th}>操作</th>
            </tr>
          </thead>
          <tbody>
            {data.items.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-10 text-center text-neutral-600">
                  没有符合条件的学生
                </td>
              </tr>
            )}
            {data.items.map((s) => {
              const isAdmin = s.role === "ADMIN";
              const busy = togglingId === s.id;
              return (
                <tr key={s.id} className="border-b border-hairline">
                  <td className={td}>
                    <div className="font-medium">{s.name}</div>
                    <div className="text-xs text-neutral-600 tabular-nums">{s.phone ?? "—"}</div>
                  </td>
                  <td className={td}>
                    <Tag variant={isAdmin ? "solid" : "neutral"}>{isAdmin ? "管理员" : "学生"}</Tag>
                  </td>
                  <td className={td}>
                    <div>{tierLabel[s.tier]}</div>
                    {s.tier === "PRO" && s.proExpiresAt && (
                      <div className="text-xs text-neutral-600 tabular-nums">到 {s.proExpiresAt.slice(0, 10)}</div>
                    )}
                  </td>
                  <td className={td}>
                    <Tag variant={s.enabled ? "accent" : "outline"}>{s.enabled ? "启用" : "停用"}</Tag>
                  </td>
                  <td className={`${td} text-neutral-700 tabular-nums`}>
                    收藏 {s.stats.favorites} · 投递 {s.stats.applications} · 作答 {s.stats.attempts}
                  </td>
                  <td className={`${td} text-neutral-700 tabular-nums`}>
                    {new Date(s.createdAt).toLocaleDateString("zh-CN")}
                  </td>
                  <td className={td}>
                    <div className="flex gap-1.5">
                      <Button size="sm" disabled={isAdmin || busy} onClick={() => toggleEnabled(s)}>
                        {s.enabled ? "停用" : "启用"}
                      </Button>
                      <Button size="sm" disabled={isAdmin} onClick={() => setPlanTarget(s)}>
                        档位
                      </Button>
                      <Button size="sm" disabled={isAdmin} onClick={() => setGrantsTarget(s)}>
                        授权 ({s.grants.length})
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
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
