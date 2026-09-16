import { useEffect, useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { useDeleteQuestion, usePatchQuestion } from "@api/mutations";
import { questionsQuery, quizMetaQuery } from "@api/queries";
import type { AdminQuestion } from "@api/types";
import { Button } from "@shared/ui/Button";
import { Input } from "@shared/ui/Input";
import { Pagination } from "@shared/ui/Pagination";
import { Select } from "@shared/ui/Select";
import { Tag } from "@shared/ui/Tag";
import { CategoryDialog } from "./CategoryDialog";
import { QuestionDialog } from "./QuestionDialog";
import { DIFFICULTY_LABEL } from "./question-form";

const route = getRouteApi("/_admin/questions");

const th = "px-3 py-2 text-left text-[11px] font-medium uppercase tracking-[0.08em] text-neutral-700";
const td = "px-3 py-2.5 align-top whitespace-nowrap";

const PROMPT_MAX = 60;

function truncate(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

type DialogState = { kind: "create" } | { kind: "edit"; question: AdminQuestion } | { kind: "category" } | null;

export function QuestionsPage() {
  const search = route.useSearch();
  const navigate = route.useNavigate();
  const { data } = useSuspenseQuery(questionsQuery(search));
  const { data: meta } = useSuspenseQuery(quizMetaQuery());
  const patch = usePatchQuestion();
  const remove = useDeleteQuestion();
  const [dialog, setDialog] = useState<DialogState>(null);

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

  function togglePublished(q: AdminQuestion) {
    patch.mutate({ id: q.id, body: { published: !q.published } });
  }
  const togglingId = patch.isPending ? patch.variables?.id : undefined;

  function confirmDelete(q: AdminQuestion) {
    if (!window.confirm("删除该题？作答与错题记录会一并删除")) return;
    remove.mutate(q.id);
  }
  const deletingId = remove.isPending ? remove.variables : undefined;

  const actionError = patch.error ?? remove.error;

  return (
    <>
      <h1 className="text-3xl">题库</h1>
      <p className="mt-2 text-sm text-neutral-700">学生端刷题的单选题；未发布的题目学生看不到。</p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Input
          type="search"
          aria-label="搜索题目"
          placeholder="搜索题干"
          className="sm:w-[260px]"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <Select
          aria-label="分类"
          className="min-h-9 sm:w-[180px]"
          value={search.categoryId ?? ""}
          onChange={(e) => {
            const categoryId = e.target.value || undefined;
            navigate({ search: (s) => ({ ...s, categoryId, page: 1 }) });
          }}
        >
          <option value="">全部分类</option>
          {meta.categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.questionCount})
            </option>
          ))}
        </Select>
        <Select
          aria-label="状态"
          className="min-h-9 sm:w-[140px]"
          value={search.published === undefined ? "" : String(search.published)}
          onChange={(e) => {
            const published = e.target.value === "" ? undefined : e.target.value === "true";
            navigate({ search: (s) => ({ ...s, published, page: 1 }) });
          }}
        >
          <option value="">全部状态</option>
          <option value="true">已发布</option>
          <option value="false">未发布</option>
        </Select>
        <div className="ml-auto flex gap-2">
          <Button onClick={() => setDialog({ kind: "category" })}>新建分类</Button>
          <Button variant="primary" onClick={() => setDialog({ kind: "create" })}>
            新增题目
          </Button>
        </div>
      </div>

      {actionError && (
        <p role="alert" className="mt-3 text-xs text-red-700">
          操作失败：{actionError.message}
        </p>
      )}

      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-divider">
              <th className={th}>题干</th>
              <th className={th}>分类</th>
              <th className={th}>难度</th>
              <th className={th}>来源</th>
              <th className={th}>状态</th>
              <th className={th}>操作</th>
            </tr>
          </thead>
          <tbody>
            {data.items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-10 text-center text-neutral-600">
                  没有符合条件的题目
                </td>
              </tr>
            )}
            {data.items.map((q) => {
              const toggling = togglingId === q.id;
              const deleting = deletingId === q.id;
              return (
                <tr key={q.id} className="border-b border-hairline">
                  <td className={`${td} max-w-[420px] whitespace-normal`} title={q.prompt}>
                    {truncate(q.prompt, PROMPT_MAX)}
                  </td>
                  <td className={`${td} text-neutral-700`}>{q.categoryName}</td>
                  <td className={`${td} text-neutral-700`}>{DIFFICULTY_LABEL[q.difficulty]}</td>
                  <td className={`${td} text-neutral-700`}>{q.source}</td>
                  <td className={td}>
                    <Tag>{q.published ? "已发布" : "未发布"}</Tag>
                  </td>
                  <td className={td}>
                    <div className="flex gap-1.5">
                      <Button size="sm" onClick={() => setDialog({ kind: "edit", question: q })}>
                        编辑
                      </Button>
                      <Button size="sm" disabled={toggling || deleting} onClick={() => togglePublished(q)}>
                        {toggling ? "处理中…" : q.published ? "下架" : "发布"}
                      </Button>
                      <Button size="sm" disabled={toggling || deleting} onClick={() => confirmDelete(q)}>
                        {deleting ? "删除中…" : "删除"}
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

      <QuestionDialog
        mode={dialog?.kind === "edit" ? "edit" : "create"}
        question={dialog?.kind === "edit" ? dialog.question : null}
        meta={meta}
        open={dialog?.kind === "create" || dialog?.kind === "edit"}
        onClose={() => setDialog(null)}
      />
      <CategoryDialog open={dialog?.kind === "category"} onClose={() => setDialog(null)} />
    </>
  );
}
