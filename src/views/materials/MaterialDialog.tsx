import { useState } from "react";
import { useSaveContent } from "@api/mutations";
import type { AdminContentBody, AdminMaterial } from "@api/types";
import { Button } from "@shared/ui/Button";
import { Dialog } from "@shared/ui/Dialog";
import { Field } from "@shared/ui/Field";
import { Input } from "@shared/ui/Input";
import { Textarea } from "@shared/ui/Textarea";

const FORM_ID = "material-form";
const DEFAULT_CATEGORY = "未分类";
const HTTP_RE = /^https?:\/\//;

interface MaterialDialogProps {
  mode: "create" | "edit";
  material: AdminMaterial | null;
  open: boolean;
  onClose: () => void;
}

/** 新增 / 编辑资料：同一个表单，edit 时用 material 预填，保存走 useSaveContent（带 id 即更新） */
export function MaterialDialog({ mode, material, open, onClose }: MaterialDialogProps) {
  const save = useSaveContent();

  function close() {
    save.reset();
    onClose();
  }

  return (
    <Dialog
      open={open}
      title={mode === "create" ? "新增资料" : "编辑资料"}
      onClose={close}
      footer={
        <>
          <Button type="button" onClick={close}>
            取消
          </Button>
          <Button variant="primary" type="submit" form={FORM_ID} disabled={save.isPending}>
            {save.isPending ? "保存中…" : "保存"}
          </Button>
        </>
      }
    >
      {open && (mode === "create" || material) && (
        <MaterialForm
          key={material?.id ?? "new"}
          material={material}
          serverError={save.error?.message ?? null}
          onSubmit={(body) => save.mutate(body, { onSuccess: close })}
        />
      )}
    </Dialog>
  );
}

interface MaterialFormState {
  title: string;
  description: string;
  category: string;
  url: string;
  published: boolean;
}

interface MaterialFormProps {
  material: AdminMaterial | null;
  serverError: string | null;
  onSubmit: (body: AdminContentBody) => void;
}

function MaterialForm({ material, serverError, onSubmit }: MaterialFormProps) {
  const [state, setState] = useState<MaterialFormState>(() =>
    material
      ? {
          title: material.title,
          description: material.description ?? "",
          category: material.category,
          url: material.resourceUrl,
          published: material.published,
        }
      : { title: "", description: "", category: DEFAULT_CATEGORY, url: "", published: false },
  );
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof MaterialFormState>(key: K, value: MaterialFormState[K]) {
    setState((s) => ({ ...s, [key]: value }));
  }

  return (
    <form
      id={FORM_ID}
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        const title = state.title.trim();
        if (!title) {
          setError("请填写标题");
          return;
        }
        const url = state.url.trim();
        if (!HTTP_RE.test(url)) {
          setError("链接需以 http:// 或 https:// 开头");
          return;
        }
        setError(null);
        const description = state.description.trim();
        onSubmit({
          type: "MATERIAL",
          id: material?.id,
          title,
          description: description || null,
          category: state.category.trim() || DEFAULT_CATEGORY,
          url,
          published: state.published,
        });
      }}
    >
      <Field label="标题" htmlFor="material-title">
        <Input id="material-title" value={state.title} onChange={(e) => set("title", e.target.value)} />
      </Field>
      <Field label="描述" htmlFor="material-description" hint="可选；学生端列表里显示">
        <Textarea
          id="material-description"
          rows={3}
          value={state.description}
          onChange={(e) => set("description", e.target.value)}
        />
      </Field>
      <Field label="分类" htmlFor="material-category" hint="如「简历」「面经」；留空为「未分类」">
        <Input id="material-category" value={state.category} onChange={(e) => set("category", e.target.value)} />
      </Field>
      <Field label="链接" htmlFor="material-url" hint="学生点击后打开的地址，需以 http:// 或 https:// 开头">
        <Input
          id="material-url"
          inputMode="url"
          placeholder="https://"
          value={state.url}
          onChange={(e) => set("url", e.target.value)}
        />
      </Field>

      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input type="checkbox" checked={state.published} onChange={(e) => set("published", e.target.checked)} />
        已发布（学生端可见）
      </label>

      {(error || serverError) && (
        <p role="alert" className="text-xs text-red-700">
          {error ?? `保存失败：${serverError}`}
        </p>
      )}
    </form>
  );
}
