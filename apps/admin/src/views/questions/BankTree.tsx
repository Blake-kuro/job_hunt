import type { AdminQuizMeta } from "@job-hunt/api-client/types";
import { cn } from "@job-hunt/ui/lib/utils";
import { Button } from "@job-hunt/ui/components/button";

type Company = AdminQuizMeta["companies"][number];
type Category = Company["categories"][number];

export interface BankTreeProps {
  meta: AdminQuizMeta;
  selectedCompanyId?: string;
  selectedCategoryId?: string;
  /** 正在删除的公司 / 分类 id，用于禁用对应行 */
  busyId?: string;
  onSelectAll: () => void;
  onSelectCompany: (company: Company) => void;
  onSelectCategory: (company: Company, category: Category) => void;
  onCreateCompany: () => void;
  onRenameCompany: (company: Company) => void;
  onDeleteCompany: (company: Company) => void;
  onCreateCategory: (company: Company) => void;
  onRenameCategory: (company: Company, category: Category) => void;
  onDeleteCategory: (company: Company, category: Category) => void;
  onImport: (company: Company, category: Category) => void;
}

const rowBase = "group flex min-h-9 items-center gap-2 pr-2 text-sm";
const nameBtn = "flex min-w-0 flex-1 cursor-pointer items-baseline gap-1.5 py-1.5 text-left hover:text-accent";
const actions =
  "flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100";
const actionBtn = "cursor-pointer px-1 text-[11px] text-neutral-700 hover:text-accent disabled:cursor-not-allowed";

/** 左栏：公司 → 分类树。选中态由父组件通过 URL 传入 */
export function BankTree({
  meta,
  selectedCompanyId,
  selectedCategoryId,
  busyId,
  onSelectAll,
  onSelectCompany,
  onSelectCategory,
  onCreateCompany,
  onRenameCompany,
  onDeleteCompany,
  onCreateCategory,
  onRenameCategory,
  onDeleteCategory,
  onImport,
}: BankTreeProps) {
  const nothingSelected = !selectedCompanyId && !selectedCategoryId;
  return (
    <nav aria-label="公司与分类" className="flex flex-col border border-divider bg-surface">
      <div className="flex items-center justify-between border-b border-divider px-3 py-2">
        <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-neutral-700">公司 / 分类</span>
        <Button size="sm" onClick={onCreateCompany}>
          新建公司
        </Button>
      </div>

      <ul className="flex flex-col py-1">
        <li className={cn(rowBase, "px-3", nothingSelected && "bg-accent-100 text-accent-800")}>
          <button
            type="button"
            className={nameBtn}
            aria-current={nothingSelected ? "true" : undefined}
            onClick={onSelectAll}
          >
            全部题目
          </button>
        </li>

        {meta.companies.length === 0 && (
          <li className="px-3 py-6 text-center text-xs text-neutral-600">还没有公司，先新建一个</li>
        )}

        {meta.companies.map((company) => {
          const companyActive = selectedCompanyId === company.id;
          const busy = busyId === company.id;
          return (
            <li key={company.id} className="mt-1">
              <div className={cn(rowBase, "px-3", companyActive && "bg-accent-100 text-accent-800")}>
                <button
                  type="button"
                  className={cn(nameBtn, "font-heading font-semibold")}
                  aria-current={companyActive ? "true" : undefined}
                  disabled={busy}
                  title={company.name}
                  onClick={() => onSelectCompany(company)}
                >
                  <span className="truncate">{company.name}</span>
                </button>
                <span className={actions}>
                  <button type="button" className={actionBtn} disabled={busy} onClick={() => onCreateCategory(company)}>
                    新建分类
                  </button>
                  <button type="button" className={actionBtn} disabled={busy} onClick={() => onRenameCompany(company)}>
                    重命名
                  </button>
                  <button type="button" className={actionBtn} disabled={busy} onClick={() => onDeleteCompany(company)}>
                    {busy ? "删除中…" : "删除"}
                  </button>
                </span>
              </div>

              <ul>
                {company.categories.length === 0 && <li className="py-1 pl-7 text-xs text-neutral-600">暂无分类</li>}
                {company.categories.map((category) => {
                  const active = selectedCategoryId === category.id;
                  const catBusy = busy || busyId === category.id;
                  return (
                    <li key={category.id} className={cn(rowBase, "pl-7", active && "bg-accent-100 text-accent-800")}>
                      <button
                        type="button"
                        className={nameBtn}
                        aria-current={active ? "true" : undefined}
                        disabled={catBusy}
                        title={`${category.name}（已发布 ${category.publishedCount} / 共 ${category.questionCount}）`}
                        onClick={() => onSelectCategory(company, category)}
                      >
                        <span className="truncate">{category.name}</span>
                        <span className="shrink-0 text-xs text-neutral-600 tabular-nums">{category.questionCount}</span>
                      </button>
                      <span className={actions}>
                        <button
                          type="button"
                          className={actionBtn}
                          disabled={catBusy}
                          onClick={() => onImport(company, category)}
                        >
                          导入
                        </button>
                        <button
                          type="button"
                          className={actionBtn}
                          disabled={catBusy}
                          onClick={() => onRenameCategory(company, category)}
                        >
                          重命名
                        </button>
                        <button
                          type="button"
                          className={actionBtn}
                          disabled={catBusy}
                          onClick={() => onDeleteCategory(company, category)}
                        >
                          {busyId === category.id ? "删除中…" : "删除"}
                        </button>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
