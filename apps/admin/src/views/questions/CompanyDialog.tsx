import { useCreateCompany, usePatchCompany } from "@api/mutations";
import { NameDialog } from "./NameDialog";

interface CompanyDialogProps {
  open: boolean;
  mode: "create" | "rename";
  /** rename 时的当前公司 */
  initial?: { id: string; name: string } | null;
  onClose: () => void;
}

/** 新建 / 重命名公司：只有一个名称字段 */
export function CompanyDialog({ open, mode, initial, onClose }: CompanyDialogProps) {
  const create = useCreateCompany();
  const patch = usePatchCompany();
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
      await create.mutateAsync({ name });
    }
  }

  return (
    <NameDialog
      open={open}
      title={mode === "create" ? "新建公司" : "重命名公司"}
      label="公司名称"
      placeholder="如「中国华电」"
      initialName={mode === "rename" ? initial?.name : undefined}
      pending={pending}
      error={serverError}
      onSubmit={save}
      onClose={close}
    />
  );
}
