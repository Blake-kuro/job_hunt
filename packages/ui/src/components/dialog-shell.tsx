import type { ReactNode } from "react";
import { cn } from "../lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./dialog";

export interface DialogShellProps {
  open: boolean;
  title: string;
  /** 不提供时用 title 作为读屏描述（sr-only） */
  description?: string;
  onClose: () => void;
  /** 进行中：禁用 ✕，Esc / 遮罩不关闭；footer 里的按钮由调用方自行 disabled */
  closeDisabled?: boolean;
  /** 底部按钮区；不提供时不渲染 footer */
  footer?: ReactNode;
  /** 760px 宽（默认 560px） */
  wide?: boolean;
  /** 追加到 body 区（px-6 py-5，超高时只有它滚动） */
  bodyClassName?: string;
  children: ReactNode;
}

/**
 * 对话框外壳：标题栏 / 可滚动 body / 底部按钮，头尾 hairline 分隔，closeDisabled 时不可关闭。
 * 不含 `<form>`；表单对话框用 FormDialog（基于本组件）。
 */
export function DialogShell({
  open,
  title,
  description,
  onClose,
  closeDisabled = false,
  footer,
  wide = false,
  bodyClassName,
  children,
}: DialogShellProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !closeDisabled) onClose();
      }}
    >
      <DialogContent
        closeDisabled={closeDisabled}
        onEscapeKeyDown={(event) => {
          if (closeDisabled) event.preventDefault();
        }}
        onPointerDownOutside={(event) => {
          if (closeDisabled) event.preventDefault();
        }}
        onInteractOutside={(event) => {
          if (closeDisabled) event.preventDefault();
        }}
        className={cn("flex flex-col gap-0 overflow-hidden p-0", wide ? "sm:max-w-[760px]" : "sm:max-w-[560px]")}
      >
        <DialogHeader className="shrink-0 border-b border-divider px-6 py-4 text-left">
          <DialogTitle className="font-heading text-xl font-semibold">{title}</DialogTitle>
          {description ? (
            <DialogDescription>{description}</DialogDescription>
          ) : (
            <DialogDescription className="sr-only">{title}</DialogDescription>
          )}
        </DialogHeader>
        {/* relative：Radix Select / Checkbox 的隐藏原生控件是 absolute，须以 body 为包含块，否则会撑大外层 overflow-hidden 的 DialogContent 并在聚焦时把头部滚出视野 */}
        <div className={cn("relative min-h-0 flex-1 overflow-y-auto px-6 py-5", bodyClassName)}>{children}</div>
        {footer && <DialogFooter className="shrink-0 border-t border-divider px-6 py-4">{footer}</DialogFooter>}
      </DialogContent>
    </Dialog>
  );
}
