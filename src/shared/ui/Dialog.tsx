import { type ReactNode, useEffect, useRef } from "react";
import { cn } from "@shared/lib/cn";

interface DialogProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}

/** 原生 <dialog> 模态框：Esc / 点击遮罩 / ✕ 都走 onClose，开关由父组件的 open 控制 */
export function Dialog({ open, title, onClose, children, footer, wide = false }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open) {
      if (!el.open) el.showModal();
    } else if (el.open) {
      el.close();
    }
  }, [open]);

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: 键盘关闭走 onCancel（Esc），点击只用于遮罩
    <dialog
      ref={ref}
      className={cn(
        "m-auto border border-divider bg-bg p-0 text-text shadow-lg backdrop:bg-text/40",
        wide ? "w-[min(92vw,760px)]" : "w-[min(92vw,560px)]",
      )}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
    >
      <div className="flex items-center justify-between border-b border-divider px-6 py-4">
        <h2 className="text-xl">{title}</h2>
        <button
          type="button"
          aria-label="关闭"
          onClick={onClose}
          className="flex size-8 cursor-pointer items-center justify-center text-neutral-600 hover:bg-surface hover:text-text"
        >
          ✕
        </button>
      </div>
      <div className="px-6 py-5">{children}</div>
      {footer && <div className="flex justify-end gap-2 border-t border-divider px-6 py-4">{footer}</div>}
    </dialog>
  );
}
