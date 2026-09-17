import { type ReactNode, useId } from "react";
import type { FieldValues, SubmitHandler, UseFormReturn } from "react-hook-form";
import { Alert, AlertDescription } from "./alert";
import { Button } from "./button";
import { DialogShell } from "./dialog-shell";
import { Form } from "./form";

interface FormDialogProps<TFieldValues extends FieldValues> {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  form: UseFormReturn<TFieldValues>;
  onSubmit: SubmitHandler<TFieldValues>;
  submitLabel?: string;
  /** pending 时提交按钮的文案 */
  pendingLabel?: string;
  cancelLabel?: string;
  /** 提交中：禁用提交按钮与 ✕，Esc / 遮罩不关闭 */
  pending?: boolean;
  /** 顶部 role="alert" 的错误信息（通常来自 mutation） */
  error?: string | null;
  wide?: boolean;
  children: ReactNode;
}

/**
 * 表单对话框：DialogShell + react-hook-form `<Form>`，footer 取消 / 提交，pending 时不可关闭。
 * `<form>` 只包住 body，提交按钮在 footer 里通过 form 属性关联，这样超高表单只有 body 滚动、头尾固定。
 */
export function FormDialog<TFieldValues extends FieldValues>({
  open,
  title,
  description,
  onClose,
  form,
  onSubmit,
  submitLabel = "保存",
  pendingLabel = "保存中…",
  cancelLabel = "取消",
  pending = false,
  error,
  wide = false,
  children,
}: FormDialogProps<TFieldValues>) {
  const formId = useId();

  return (
    <DialogShell
      open={open}
      title={title}
      description={description}
      onClose={onClose}
      closeDisabled={pending}
      wide={wide}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={pending}>
            {cancelLabel}
          </Button>
          <Button type="submit" form={formId} variant="primary" disabled={pending}>
            {pending ? pendingLabel : submitLabel}
          </Button>
        </>
      }
    >
      <Form {...form}>
        <form id={formId} noValidate onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
          {error && (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {children}
        </form>
      </Form>
    </DialogShell>
  );
}
