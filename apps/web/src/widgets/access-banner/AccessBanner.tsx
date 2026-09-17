import { Link } from "@tanstack/react-router";
import { Button } from "@job-hunt/ui/components/button";
import { cn } from "@job-hunt/ui/lib/utils";
import { type AccessInput, accessMessage } from "./access-message";

type AccessBannerProps = AccessInput & { className?: string };

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
      <Button asChild variant="primary" size="lg" blueprint>
        <Link to={m.action.to}>{m.action.label}</Link>
      </Button>
    </div>
  );
}
