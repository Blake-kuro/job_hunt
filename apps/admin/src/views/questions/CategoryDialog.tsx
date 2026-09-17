import { useCreateCategory, usePatchCategory } from "@api/mutations";
import { NameDialog } from "./NameDialog";

interface CategoryDialogProps {
  open: boolean;
  mode: "create" | "rename";
  /** 分类所属公司；新建时决定 companyId，重命名时只用于展示 */
  company: { id: string; name: string } | null;
  /** rename 时的当前分类 */
  initial?: { id: string; name: string } | null;
  onClose: () => void;
}

/** 新建 / 重命名分类（公司由树上的入口决定，不在这里选） */
export function CategoryDialog({ open, mode, company, initial, onClose }: CategoryDialogProps) {
  const create = useCreateCategory();
  const patch = usePatchCategory();
  const pending = create.isPending || patch.isPending;
  const serverError = (mode === "create" ? create.error : patch.error)?.message ?? null;

  function close() {
    create.reset();
    patch.reset();
    onClose();
  }

  async function save(name: string) {
    if (mode === "rename") {
      if (!initial || name === initial.name) return;
      await patch.mutateAsync({ id: initial.id, body: { name } });
    } else {
      if (!company) return;
      await create.mutateAsync({ companyId: company.id, name });
    }
  }

  return (
    <NameDialog
      open={open && company !== null}
      title={mode === "create" ? "新建分类" : "重命名分类"}
      label="分类名称"
      placeholder="如「公共与行业知识」"
      initialName={mode === "rename" ? initial?.name : undefined}
      pending={pending}
      error={serverError}
      onSubmit={save}
      onClose={close}
    >
      {company && (
        <p className="text-sm text-neutral-700">
          所属公司：<span className="text-text">{company.name}</span>
        </p>
      )}
    </NameDialog>
  );
}
