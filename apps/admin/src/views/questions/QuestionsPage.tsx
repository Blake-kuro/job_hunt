import { useEffect, useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { useDeleteCategory, useDeleteCompany, useDeleteQuestion, usePatchQuestion } from "@api/mutations";
import { questionsQuery, quizMetaQuery } from "@api/queries";
import type { AdminQuestion, QuestionType } from "@api/types";
import { Button } from "@shared/ui/Button";
import { Input } from "@shared/ui/Input";
import { Pagination } from "@shared/ui/Pagination";
import { Select } from "@shared/ui/Select";
import { Tag } from "@shared/ui/Tag";
import { BankTree } from "./BankTree";
import { CategoryDialog } from "./CategoryDialog";
import { CompanyDialog } from "./CompanyDialog";
import { ImportQuestionsDialog, type ImportTarget } from "./ImportQuestionsDialog";
import { QuestionDialog } from "./QuestionDialog";
import { TYPE_LABEL } from "./question-form";

const route = getRouteApi("/_admin/questions");

const th = "px-3 py-2 text-left text-[11px] font-medium uppercase tracking-[0.08em] text-neutral-700";
const td = "px-3 py-2.5 align-top whitespace-nowrap";

const PROMPT_MAX = 60;

function truncate(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

const TYPE_TAG: Record<QuestionType, "accent" | "neutral" | "outline"> = {
  SINGLE: "neutral",
  MULTI: "accent",
  JUDGE: "outline",
};

type Named = { id: string; name: string };

type DialogState =
  | { kind: "create" }
  | { kind: "edit"; question: AdminQuestion }
  | { kind: "company"; mode: "create" }
  | { kind: "company"; mode: "rename"; company: Named }
  | { kind: "category"; mode: "create"; company: Named }
  | { kind: "category"; mode: "rename"; company: Named; category: Named }
  | { kind: "import"; target: ImportTarget }
  | null;

/**
 * 文本筛选的本地缓冲 + 300ms 防抖：输入时不逐字改 URL；URL 从外部变化时同步回输入框。
 * commit 收到的是 trim 后的值，空串表示清除。
 */
function useDebouncedFilter(value: string, commit: (next: string) => void) {
  const [draft, setDraft] = useState(value);
  const [prev, setPrev] = useState(value);
  if (value !== prev) {
    setPrev(value);
    setDraft(value);
  }
  useEffect(() => {
    const normalized = draft.trim();
    if (normalized === value) return;
    const t = setTimeout(() => commit(normalized), 300);
    return () => clearTimeout(t);
  }, [draft, value, commit]);
  return [draft, setDraft] as const;
}

export function QuestionsPage() {
  const search = route.useSearch();
  const navigate = route.useNavigate();
  const { data } = useSuspenseQuery(questionsQuery(search));
  const { data: meta } = useSuspenseQuery(quizMetaQuery());
  const patch = usePatchQuestion();
  const remove = useDeleteQuestion();
  const removeCompany = useDeleteCompany();
  const removeCategory = useDeleteCategory();
  const [dialog, setDialog] = useState<DialogState>(null);

  const [qDraft, setQDraft] = useDebouncedFilter(search.q ?? "", (q) =>
    navigate({ search: (s) => ({ ...s, q: q || undefined, page: 1 }) }),
  );
  const [sectionDraft, setSectionDraft] = useDebouncedFilter(search.section ?? "", (section) =>
    navigate({ search: (s) => ({ ...s, section: section || undefined, page: 1 }) }),
  );

  // 当前选中的公司 / 分类（从 URL 反查树），用于标题与新建题目的默认分类
  const selectedCategory = meta.companies
    .flatMap((co) => co.categories.map((c) => ({ company: co, category: c })))
    .find((x) => x.category.id === search.categoryId);
  const selectedCompany = selectedCategory?.company ?? meta.companies.find((co) => co.id === search.companyId);

  function togglePublished(q: AdminQuestion) {
    patch.mutate({ id: q.id, body: { published: !q.published } });
  }
  const togglingId = patch.isPending ? patch.variables?.id : undefined;

  function confirmDelete(q: AdminQuestion) {
    if (!window.confirm("删除该题？作答与错题记录会一并删除")) return;
    remove.mutate(q.id);
  }
  const deletingId = remove.isPending ? remove.variables : undefined;

  function confirmDeleteCompany(company: Named) {
    if (!window.confirm(`删除公司「${company.name}」？删除公司会连同其下分类与题目一起删除`)) return;
    removeCompany.mutate(company.id, {
      onSuccess: () => {
        // 选中的分类 / 公司随之消失时回到「全部」
        if (search.companyId === company.id || selectedCategory?.company.id === company.id)
          navigate({ search: (s) => ({ ...s, companyId: undefined, categoryId: undefined, page: 1 }) });
      },
    });
  }

  function confirmDeleteCategory(category: Named) {
    if (!window.confirm(`删除分类「${category.name}」？删除分类会连同其下题目一起删除`)) return;
    removeCategory.mutate(category.id, {
      onSuccess: () => {
        if (search.categoryId === category.id) navigate({ search: (s) => ({ ...s, categoryId: undefined, page: 1 }) });
      },
    });
  }
  const busyId = removeCompany.isPending
    ? removeCompany.variables
    : removeCategory.isPending
      ? removeCategory.variables
      : undefined;

  const actionError = patch.error ?? remove.error ?? removeCompany.error ?? removeCategory.error;
  const showBank = !selectedCategory;

  return (
    <>
      <h1 className="text-3xl">题库</h1>
      <p className="mt-2 text-sm text-neutral-700">
        题目按公司 → 分类组织；支持单选、多选、判断三种题型，可按分类整表导入 Excel。未发布的题目学生看不到。
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <BankTree
          meta={meta}
          selectedCompanyId={selectedCategory ? undefined : search.companyId}
          selectedCategoryId={search.categoryId}
          busyId={busyId}
          onSelectAll={() =>
            navigate({ search: (s) => ({ ...s, companyId: undefined, categoryId: undefined, page: 1 }) })
          }
          onSelectCompany={(co) =>
            navigate({ search: (s) => ({ ...s, companyId: co.id, categoryId: undefined, page: 1 }) })
          }
          onSelectCategory={(_, c) =>
            navigate({ search: (s) => ({ ...s, companyId: undefined, categoryId: c.id, page: 1 }) })
          }
          onCreateCompany={() => setDialog({ kind: "company", mode: "create" })}
          onRenameCompany={(co) => setDialog({ kind: "company", mode: "rename", company: co })}
          onDeleteCompany={confirmDeleteCompany}
          onCreateCategory={(co) => setDialog({ kind: "category", mode: "create", company: co })}
          onRenameCategory={(co, c) => setDialog({ kind: "category", mode: "rename", company: co, category: c })}
          onDeleteCategory={(_, c) => confirmDeleteCategory(c)}
          onImport={(co, c) =>
            setDialog({ kind: "import", target: { categoryId: c.id, categoryName: c.name, companyName: co.name } })
          }
        />

        <section className="min-w-0">
          <h2 className="text-xl">
            {selectedCategory
              ? `${selectedCategory.company.name} / ${selectedCategory.category.name}`
              : (selectedCompany?.name ?? "全部题目")}
            <span className="ml-2 text-sm font-normal text-neutral-600 tabular-nums">共 {data.total} 题</span>
          </h2>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Input
              type="search"
              aria-label="搜索题目"
              placeholder="搜索题干"
              className="sm:w-[220px]"
              value={qDraft}
              onChange={(e) => setQDraft(e.target.value)}
            />
            <Select
              aria-label="题型"
              className="min-h-9 sm:w-[120px]"
              value={search.type ?? ""}
              onChange={(e) => {
                const type = (e.target.value || undefined) as QuestionType | undefined;
                navigate({ search: (s) => ({ ...s, type, page: 1 }) });
              }}
            >
              <option value="">全部题型</option>
              {(Object.keys(TYPE_LABEL) as QuestionType[]).map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABEL[t]}
                </option>
              ))}
            </Select>
            <Input
              type="search"
              aria-label="所属部分"
              placeholder="所属部分（完整名称）"
              className="sm:w-[150px]"
              value={sectionDraft}
              onChange={(e) => setSectionDraft(e.target.value)}
            />
            <Select
              aria-label="状态"
              className="min-h-9 sm:w-[120px]"
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
            <div className="ml-auto">
              <Button
                variant="primary"
                disabled={!selectedCategory}
                title={selectedCategory ? undefined : "先在左侧选择一个分类"}
                onClick={() => setDialog({ kind: "create" })}
              >
                新增题目
              </Button>
            </div>
          </div>

          {actionError && (
            <p role="alert" className="mt-3 text-xs text-red-700">
              操作失败：{actionError.message}
            </p>
          )}

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-divider">
                  <th className={`${th} w-14`}>序号</th>
                  <th className={th}>题型</th>
                  <th className={th}>所属部分</th>
                  <th className={th}>题干</th>
                  <th className={th}>状态</th>
                  <th className={th}>操作</th>
                </tr>
              </thead>
              <tbody>
                {data.items.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-10 text-center text-neutral-600">
                      {selectedCategory &&
                      !search.q &&
                      !search.type &&
                      !search.section &&
                      search.published === undefined
                        ? "该分类还没有题目，可以新增或导入 Excel"
                        : "没有符合条件的题目"}
                    </td>
                  </tr>
                )}
                {data.items.map((q) => {
                  const toggling = togglingId === q.id;
                  const deleting = deletingId === q.id;
                  return (
                    <tr key={q.id} className="border-b border-hairline">
                      <td className={`${td} text-neutral-700 tabular-nums`}>{q.sortOrder}</td>
                      <td className={td}>
                        <Tag variant={TYPE_TAG[q.type]}>{TYPE_LABEL[q.type]}</Tag>
                      </td>
                      <td className={`${td} text-neutral-700`}>{q.section ?? "—"}</td>
                      <td className={`${td} max-w-[420px] whitespace-normal`} title={q.prompt}>
                        {truncate(q.prompt, PROMPT_MAX)}
                        {showBank && (
                          <span className="mt-0.5 block text-xs text-neutral-600">
                            {q.companyName} / {q.categoryName}
                          </span>
                        )}
                      </td>
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
        </section>
      </div>

      <QuestionDialog
        mode={dialog?.kind === "edit" ? "edit" : "create"}
        question={dialog?.kind === "edit" ? dialog.question : null}
        defaultCategoryId={search.categoryId}
        meta={meta}
        open={dialog?.kind === "create" || dialog?.kind === "edit"}
        onClose={() => setDialog(null)}
      />
      <CompanyDialog
        open={dialog?.kind === "company"}
        mode={dialog?.kind === "company" ? dialog.mode : "create"}
        initial={dialog?.kind === "company" && dialog.mode === "rename" ? dialog.company : null}
        onClose={() => setDialog(null)}
      />
      <CategoryDialog
        open={dialog?.kind === "category"}
        mode={dialog?.kind === "category" ? dialog.mode : "create"}
        company={dialog?.kind === "category" ? dialog.company : null}
        initial={dialog?.kind === "category" && dialog.mode === "rename" ? dialog.category : null}
        onClose={() => setDialog(null)}
      />
      <ImportQuestionsDialog
        target={dialog?.kind === "import" ? dialog.target : null}
        onClose={() => setDialog(null)}
      />
    </>
  );
}
