import { type ErrorComponentProps, Link, useRouter } from "@tanstack/react-router";
import { Button } from "./Button";

export function ErrorPanel({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  return (
    <div className="flex flex-col items-start gap-3 px-4 py-10 sm:px-8">
      <p className="font-heading text-xl">页面加载失败</p>
      <p className="text-sm text-neutral-700">{error instanceof Error ? error.message : "请求失败，请稍后重试"}</p>
      <Button
        onClick={() => {
          void router.invalidate();
          reset();
        }}
      >
        重试
      </Button>
      <Link to="/" className="text-sm text-accent-700">
        返回概览
      </Link>
    </div>
  );
}
