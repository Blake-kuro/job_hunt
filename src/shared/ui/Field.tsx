import type { ReactNode } from "react";

interface FieldProps {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}

/** 表单项：标签 + 控件 + 可选提示 / 错误 */
export function Field({ label, htmlFor, hint, error, children }: FieldProps) {
  return (
    <label className="block" htmlFor={htmlFor}>
      <span className="mb-1.5 block text-xs font-medium text-neutral-800">{label}</span>
      {children}
      {error ? (
        <span role="alert" className="mt-1.5 block text-xs text-red-700">
          {error}
        </span>
      ) : (
        hint && <span className="mt-1.5 block text-xs text-neutral-600">{hint}</span>
      )}
    </label>
  );
}
