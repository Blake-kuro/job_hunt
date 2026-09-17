import { ErrorPanel } from "@job-hunt/ui/components/error-panel";
import { type ErrorComponentProps, Link, useRouter } from "@tanstack/react-router";

/** 路由 errorComponent：包 ErrorPanel + router.invalidate 重试 + 返回概览 */
export function RouterErrorPanel({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  return (
    <ErrorPanel
      error={error}
      onRetry={() => {
        void router.invalidate();
        reset();
      }}
      home={<Link to="/">返回概览</Link>}
    />
  );
}
