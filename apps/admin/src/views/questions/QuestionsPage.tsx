import type { AdminQuestion, QuestionType } from "@job-hunt/api-client/types";
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
import { useDeleteCategory, useDeleteCompany, useDeleteQuestion, usePatchQuestion } from "@api/mutations";
import { questionsQuery, quizMetaQuery } from "@api/queries";
import { BankTree } from "./BankTree";
import { CategoryDialog } from "./CategoryDialog";
import { CompanyDialog } from "./CompanyDialog";
import { ImportQuestionsDialog, type ImportTarget } from "./ImportQuestionsDialog";
import { QuestionDialog } from "./QuestionDialog";
import { TYPE_LABEL } from "./question-schema";

const route = getRouteApi("/_admin/questions");

/** Radix Select 的项不能是空串：筛选里的「全部」用这个哨兵值 */
const ALL = "all";

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

interface RowActions {
  /** 「全部」/ 公司视图下在题干下显示所属公司 / 分类 */
  showBank: boolean;
  togglingId?: string;
  deletingId?: string;
  onEdit: (q: AdminQuestion) => void;
  onTogglePublished: (q: AdminQuestion) => void;
  onDelete: (q: AdminQuestion) => void;
}

const buildColumns = (a: RowActions): Column<AdminQuestion>[] => [
  {
    id: "sortOrder",
    header: "序号",
    cell: (q) => <span className="text-neutral-700 tabular-nums">{q.sortOrder}</span>,
  },
  { id: "type", header: "题型", cell: (q) => <Badge variant={TYPE_TAG[q.type]}>{TYPE_LABEL[q.type]}</Badge> },
  { id: "section", header: "所属部分", cell: (q) => <span className="text-neutral-700">{q.section ?? "—"}</span> },
  {
    id: "prompt",
    header: "题干",
    cell: (q) => (
      <div className="max-w-[420px] whitespace-normal" title={q.prompt}>
        {truncate(q.prompt, PROMPT_MAX)}
        {a.showBank && (
          <span className="mt-0.5 block text-xs text-neutral-600">
            {q.companyName} / {q.categoryName}
          </span>
        )}
      </div>
    ),
  },
  { id: "published", header: "状态", cell: (q) => <Badge>{q.published ? "已发布" : "未发布"}</Badge> },
  {
    id: "actions",
    header: "操作",
    cell: (q) => {
      const toggling = a.togglingId === q.id;
      const deleting = a.deletingId === q.id;
      return (
        <div className="flex gap-1.5">
          <Button size="sm" onClick={() => a.onEdit(q)}>
            编辑
          </Button>
          <Button size="sm" disabled={toggling || deleting} onClick={() => a.onTogglePublished(q)}>
            {toggling ? "处理中…" : q.published ? "下架" : "发布"}
          </Button>
          <Button size="sm" disabled={toggling || deleting} onClick={() => a.onDelete(q)}>
            {deleting ? "删除中…" : "删除"}
          </Button>
        </div>
      );
    },
  },
];

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

  // 文本筛选的本地缓冲 + 300ms 防抖：输入时不逐字改 URL；URL 从外部变化时同步回输入框
  const commitQ = useCallback(
    (q: string) => navigate({ search: (s) => ({ ...s, q: q || undefined, page: 1 }) }),
    [navigate],
  );
  const commitSection = useCallback(
    (section: string) => navigate({ search: (s) => ({ ...s, section: section || undefined, page: 1 }) }),
    [navigate],
  );
  const [qDraft, setQDraft] = useDebouncedSearch(search.q ?? "", commitQ);
  const [sectionDraft, setSectionDraft] = useDebouncedSearch(search.section ?? "", commitSection);

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
  const columns = buildColumns({
    showBank,
    togglingId,
    deletingId,
    onEdit: (question) => setDialog({ kind: "edit", question }),
    onTogglePublished: togglePublished,
    onDelete: confirmDelete,
  });
  const emptyMessage =
    selectedCategory && !search.q && !search.type && !search.section && search.published === undefined
      ? "该分类还没有题目，可以新增或导入 Excel"
      : "没有符合条件的题目";

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
              value={search.type ?? ALL}
              onValueChange={(v) => {
                const type = v === ALL ? undefined : (v as QuestionType);
                navigate({ search: (s) => ({ ...s, type, page: 1 }) });
              }}
            >
              <SelectTrigger aria-label="题型" className="sm:w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>全部题型</SelectItem>
                {(Object.keys(TYPE_LABEL) as QuestionType[]).map((t) => (
                  <SelectItem key={t} value={t}>
                    {TYPE_LABEL[t]}
                  </SelectItem>
                ))}
              </SelectContent>
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
              value={search.published === undefined ? ALL : String(search.published)}
              onValueChange={(v) => {
                const published = v === ALL ? undefined : v === "true";
                navigate({ search: (s) => ({ ...s, published, page: 1 }) });
              }}
            >
              <SelectTrigger aria-label="状态" className="sm:w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>全部状态</SelectItem>
                <SelectItem value="true">已发布</SelectItem>
                <SelectItem value="false">未发布</SelectItem>
              </SelectContent>
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

          <div className="mt-4 pb-6">
            <DataTable
              columns={columns}
              rows={data.items}
              rowKey={(q) => q.id}
              caption="题目列表"
              layout="auto"
              nowrap
              flush
              emptyMessage={emptyMessage}
            />
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
