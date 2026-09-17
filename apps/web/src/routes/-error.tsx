import { type ErrorComponentProps, Link, useRouter } from "@tanstack/react-router";
import { ErrorPanel } from "@job-hunt/ui/components/error-panel";

/** 路由级错误面板：包 ErrorPanel 不依赖 router，这里接 ErrorComponentProps（重试 = 重新跑 loader + 重置错误边界）。 */
export function RouterErrorPanel({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  return (
    <ErrorPanel
      error={error}
      onRetry={() => {
        void router.invalidate();
        reset();
      }}
      home={<Link to="/">返回岗位看板</Link>}
    />
  );
}
