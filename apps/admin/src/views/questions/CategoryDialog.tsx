import { useCreateCategory, usePatchCategory } from "@api/mutations";
import { Button } from "@shared/ui/Button";
import { Dialog } from "@shared/ui/Dialog";
import { NAME_FORM_ID, NameForm } from "./CompanyDialog";

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

  function save(name: string) {
    if (mode === "rename") {
      if (!initial) return;
      if (name === initial.name) return close();
      patch.mutate({ id: initial.id, body: { name } }, { onSuccess: close });
    } else {
      if (!company) return;
      create.mutate({ companyId: company.id, name }, { onSuccess: close });
    }
  }

  return (
    <Dialog
      open={open}
      title={mode === "create" ? "新建分类" : "重命名分类"}
      onClose={close}
      footer={
        <>
          <Button type="button" onClick={close}>
            取消
          </Button>
          <Button variant="primary" type="submit" form={NAME_FORM_ID} disabled={pending}>
            {pending ? "保存中…" : "保存"}
          </Button>
        </>
      }
    >
      {open && company && (
        <NameForm
          key={initial?.id ?? `new-${company.id}`}
          label="分类名称"
          placeholder="如「公共与行业知识」"
          initial={initial?.name ?? ""}
          serverError={serverError}
          onSubmit={save}
        >
          <p className="text-sm text-neutral-700">
            所属公司：<span className="text-text">{company.name}</span>
          </p>
        </NameForm>
      )}
    </Dialog>
  );
}
