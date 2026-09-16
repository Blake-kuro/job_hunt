import type { ReactNode } from "react";
import type { FieldValues, SubmitHandler, UseFormReturn } from "react-hook-form";
import { cn } from "../lib/utils";
import { Alert, AlertDescription } from "./alert";
import { Button } from "./button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./dialog";
import { Form } from "./form";

interface FormDialogProps<TFieldValues extends FieldValues> {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  form: UseFormReturn<TFieldValues>;
  onSubmit: SubmitHandler<TFieldValues>;
  submitLabel?: string;
  cancelLabel?: string;
  /** 提交中：禁用提交按钮，Esc / 遮罩 / ✕ 不关闭 */
  pending?: boolean;
  /** 顶部 role="alert" 的错误信息（通常来自 mutation） */
  error?: string | null;
  wide?: boolean;
  children: ReactNode;
}

/** 表单对话框：Dialog + react-hook-form `<Form>`，footer 取消 / 提交，pending 时不可关闭。 */
export function FormDialog<TFieldValues extends FieldValues>({
  open,
  title,
  description,
  onClose,
  form,
  onSubmit,
  submitLabel = "保存",
  cancelLabel = "取消",
  pending = false,
  error,
  wide = false,
  children,
}: FormDialogProps<TFieldValues>) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !pending) onClose();
      }}
    >
      <DialogContent
        showCloseButton={!pending}
        onEscapeKeyDown={(event) => {
          if (pending) event.preventDefault();
        }}
        onPointerDownOutside={(event) => {
          if (pending) event.preventDefault();
        }}
        onInteractOutside={(event) => {
          if (pending) event.preventDefault();
        }}
        className={cn("gap-0 p-0", wide ? "sm:max-w-[760px]" : "sm:max-w-[560px]")}
      >
        <DialogHeader className="border-b border-divider px-6 py-4 text-left">
          <DialogTitle className="font-heading text-xl font-semibold">{title}</DialogTitle>
          {description ? (
            <DialogDescription>{description}</DialogDescription>
          ) : (
            <DialogDescription className="sr-only">{title}</DialogDescription>
          )}
        </DialogHeader>
        <Form {...form}>
          <form noValidate onSubmit={form.handleSubmit(onSubmit)}>
            <div className="flex flex-col gap-4 px-6 py-5">
              {error && (
                <Alert variant="destructive" role="alert">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              {children}
            </div>
            <DialogFooter className="border-t border-divider px-6 py-4">
              <Button type="button" variant="secondary" onClick={onClose} disabled={pending}>
                {cancelLabel}
              </Button>
              <Button type="submit" variant="primary" disabled={pending}>
                {submitLabel}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
