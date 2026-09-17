import { zodResolver } from "@hookform/resolvers/zod";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@job-hunt/ui/components/form";
import { FormDialog } from "@job-hunt/ui/components/form-dialog";
import { Input } from "@job-hunt/ui/components/input";
import { type ReactNode, useEffect } from "react";
import { useForm } from "react-hook-form";
import { defaultValues, type FormValues, fromEntity, schema, toBody } from "./category-schema";

interface NameDialogProps {
  open: boolean;
  title: string;
  label: string;
  placeholder?: string;
  /** rename 时的当前名称；undefined = 新建 */
  initialName?: string;
  pending: boolean;
  /** mutation 错误文案（不含「保存失败：」前缀） */
  error: string | null;
  /** 只在名称非空时触发，已 trim */
  onSubmit: (name: string) => Promise<void>;
  onClose: () => void;
  children?: ReactNode;
}

/** 公司 / 分类共用的单名称对话框 */
export function NameDialog({
  open,
  title,
  label,
  placeholder,
  initialName,
  pending,
  error,
  onSubmit,
  onClose,
  children,
}: NameDialogProps) {
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues });

  useEffect(() => {
    if (open) form.reset(initialName === undefined ? defaultValues : fromEntity({ name: initialName }));
  }, [open, initialName, form]);

  return (
    <FormDialog
      open={open}
      title={title}
      onClose={onClose}
      form={form}
      onSubmit={async (values) => {
        try {
          await onSubmit(toBody(values).name);
        } catch {
          return; // 错误由调用方的 mutation.error 显示在对话框顶部
        }
        onClose();
      }}
      pending={pending}
      submitLabel={pending ? "保存中…" : "保存"}
      error={error && `保存失败：${error}`}
    >
      {children}
      <FormField
        control={form.control}
        name="name"
        render={({ field }) => (
          <FormItem className="gap-1.5">
            <FormLabel className="text-xs text-neutral-800">{label}</FormLabel>
            <FormControl>
              <Input autoFocus maxLength={50} placeholder={placeholder} {...field} />
            </FormControl>
            <FormMessage className="text-xs" />
          </FormItem>
        )}
      />
    </FormDialog>
  );
}
