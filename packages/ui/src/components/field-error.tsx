import type * as React from "react";
import { type FieldPath, type FieldValues, get, useFormContext, useFormState } from "react-hook-form";
import { cn } from "../lib/utils";

interface FieldErrorProps<TFieldValues extends FieldValues> extends Omit<React.ComponentProps<"p">, "children"> {
  /** 表单字段路径；数组字段（useFieldArray）挂在根上的错误会自动读 `${name}.root` */
  name: FieldPath<TFieldValues>;
}

/**
 * 不经 `<FormField>` 的错误文案：直接按路径从 formState.errors 取 message，样式同 FormMessage。
 * 用于 superRefine 挂在数组根（如 `options` / `lessons`）上的跨行校验 —— 给数组根套 Controller 会和 useFieldArray 冲突。
 */
export function FieldError<TFieldValues extends FieldValues = FieldValues>({
  name,
  className,
  ...props
}: FieldErrorProps<TFieldValues>) {
  const { control } = useFormContext<TFieldValues>();
  const { errors } = useFormState({ control, name });
  const error = get(errors, name);
  const message = error?.message ?? error?.root?.message;

  if (!message) return null;

  return (
    <p data-slot="field-error" role="alert" className={cn("text-xs text-destructive", className)} {...props}>
      {String(message)}
    </p>
  );
}
