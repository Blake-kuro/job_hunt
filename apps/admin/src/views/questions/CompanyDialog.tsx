import { useState } from "react";
import { useCreateCompany, usePatchCompany } from "@api/mutations";
import { Button } from "@shared/ui/Button";
import { Dialog } from "@shared/ui/Dialog";
import { Field } from "@shared/ui/Field";
import { Input } from "@shared/ui/Input";

/** 公司 / 分类对话框同一时间只开一个，共用 form id */
export const NAME_FORM_ID = "bank-name-form";

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

  function save(name: string) {
    if (mode === "rename") {
      if (!initial) return;
      if (name === initial.name) return close();
      patch.mutate({ id: initial.id, body: { name } }, { onSuccess: close });
    } else {
      create.mutate({ name }, { onSuccess: close });
    }
  }

  return (
    <Dialog
      open={open}
      title={mode === "create" ? "新建公司" : "重命名公司"}
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
      {open && (
        <NameForm
          key={initial?.id ?? "new"}
          label="公司名称"
          placeholder="如「中国华电」"
          initial={initial?.name ?? ""}
          serverError={serverError}
          onSubmit={save}
        />
      )}
    </Dialog>
  );
}

interface NameFormProps {
  label: string;
  placeholder?: string;
  initial: string;
  serverError: string | null;
  /** 只在名称非空时触发，已 trim */
  onSubmit: (name: string) => void;
  children?: React.ReactNode;
}

/** 公司 / 分类共用的单名称表单 */
export function NameForm({ label, placeholder, initial, serverError, onSubmit, children }: NameFormProps) {
  const [name, setName] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      id={NAME_FORM_ID}
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        const trimmed = name.trim();
        if (!trimmed) {
          setError("请填写名称");
          return;
        }
        setError(null);
        onSubmit(trimmed);
      }}
    >
      {children}
      <Field label={label} htmlFor="bank-name">
        <Input
          id="bank-name"
          autoFocus
          maxLength={50}
          placeholder={placeholder}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </Field>
      {(error || serverError) && (
        <p role="alert" className="text-xs text-red-700">
          {error ?? `保存失败：${serverError}`}
        </p>
      )}
    </form>
  );
}
