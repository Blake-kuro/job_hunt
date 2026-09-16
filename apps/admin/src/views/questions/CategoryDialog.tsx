import { useState } from "react";
import { useCreateCategory } from "@api/mutations";
import { Button } from "@shared/ui/Button";
import { Dialog } from "@shared/ui/Dialog";
import { Field } from "@shared/ui/Field";
import { Input } from "@shared/ui/Input";

const FORM_ID = "category-form";

interface CategoryDialogProps {
  open: boolean;
  onClose: () => void;
}

/** 新建题目分类：只有一个名称；重名由后端返回 400「分类已存在」 */
export function CategoryDialog({ open, onClose }: CategoryDialogProps) {
  const create = useCreateCategory();

  function close() {
    create.reset();
    onClose();
  }

  return (
    <Dialog
      open={open}
      title="新建分类"
      onClose={close}
      footer={
        <>
          <Button type="button" onClick={close}>
            取消
          </Button>
          <Button variant="primary" type="submit" form={FORM_ID} disabled={create.isPending}>
            {create.isPending ? "创建中…" : "创建"}
          </Button>
        </>
      }
    >
      {open && (
        <CategoryForm
          serverError={create.error?.message ?? null}
          onSubmit={(name) => create.mutate({ name }, { onSuccess: close })}
        />
      )}
    </Dialog>
  );
}

interface CategoryFormProps {
  serverError: string | null;
  onSubmit: (name: string) => void;
}

function CategoryForm({ serverError, onSubmit }: CategoryFormProps) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      id={FORM_ID}
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        const trimmed = name.trim();
        if (!trimmed) {
          setError("请填写分类名称");
          return;
        }
        setError(null);
        onSubmit(trimmed);
      }}
    >
      <Field label="分类名称" htmlFor="category-name" hint="如「JavaScript」「计算机网络」">
        <Input id="category-name" value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      {(error || serverError) && (
        <p role="alert" className="text-xs text-red-700">
          {error ?? `创建失败：${serverError}`}
        </p>
      )}
    </form>
  );
}
