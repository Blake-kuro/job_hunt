import { Link } from "@tanstack/react-router";
import { cn } from "@shared/lib/cn";
import { type AccessInput, accessMessage } from "./access-message";

type AccessBannerProps = AccessInput & { className?: string };

/**
 * `Button`（src/shared/ui/Button.tsx）不支持 `asChild`，无法把它的根元素换成 `Link`。
 * 这里手动复刻 `variant="primary" size="lg" blueprint` 时 Button 产出的类名与角标记（.corner），
 * 直接套在 `Link` 上，保持视觉一致。
 */
const primaryLgBlueprintClass = cn(
  "inline-flex shrink-0 cursor-pointer items-center whitespace-nowrap justify-center gap-1.5 border font-heading font-semibold leading-tight transition-colors",
  "disabled:cursor-not-allowed disabled:opacity-45",
  "bg-accent text-bg border-accent hover:bg-accent-600 active:bg-accent-700",
  "text-sm px-4 py-2",
  "blueprint",
);

export function AccessBanner({ className, ...input }: AccessBannerProps) {
  const m = accessMessage(input);
  if (!m) return null;
  return (
    <div
      className={cn(
        "flex flex-col gap-3 border border-accent bg-accent-100 px-4 py-4 sm:flex-row sm:items-center sm:px-5",
        className,
      )}
    >
      <div className="flex-1">
        <p className="font-heading text-lg">{m.title}</p>
        <p className="mt-1 text-sm text-neutral-700">{m.body}</p>
      </div>
      <Link to={m.action.to} className={primaryLgBlueprintClass}>
        {m.action.label}
        <i className="corner tl" />
        <i className="corner tr" />
        <i className="corner bl" />
        <i className="corner br" />
      </Link>
    </div>
  );
}
