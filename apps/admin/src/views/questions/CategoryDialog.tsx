import { useState } from "react";
import { useCreateCategory, useCreateCompany } from "@api/mutations";
import type { AdminQuizMeta } from "@api/types";
import { Button } from "@shared/ui/Button";
import { Dialog } from "@shared/ui/Dialog";
import { Input } from "@shared/ui/Input";
import { Select } from "@shared/ui/Select";
export function CategoryDialog({
  open,
  onClose,
  meta,
  company = false,
}: {
  open: boolean;
  onClose: () => void;
  meta: AdminQuizMeta;
  company?: boolean;
}) {
  const categoryCreate = useCreateCategory();
  const companyCreate = useCreateCompany();
  const [name, setName] = useState("");
  const [companyId, setCompanyId] = useState("");
  const pending = categoryCreate.isPending || companyCreate.isPending;
  const error = categoryCreate.error ?? companyCreate.error;
  function close() {
    setName("");
    setCompanyId("");
    categoryCreate.reset();
    companyCreate.reset();
    onClose();
  }
  return (
    <Dialog open={open} title={company ? "新建公司" : "新建分类"} onClose={close}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim() || pending) return;
          if (company) companyCreate.mutate({ name: name.trim() }, { onSuccess: close });
          else if (companyId) categoryCreate.mutate({ name: name.trim(), companyId }, { onSuccess: close });
        }}
      >
        {!company && (
          <Select required aria-label="所属公司" value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
            <option value="">请选择公司</option>
            {meta.companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        )}
        <Input
          required
          maxLength={50}
          aria-label="名称"
          placeholder={company ? "公司名称" : "分类名称"}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        {error && <p role="alert">{error.message}</p>}
        <Button type="submit" disabled={pending || !name.trim() || (!company && !companyId)}>
          {pending ? "创建中…" : "创建"}
        </Button>
      </form>
    </Dialog>
  );
}
