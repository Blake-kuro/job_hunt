import type { ReactNode } from "react";
import { Button } from "./button";

interface ErrorPanelProps {
  error: unknown;
  onRetry?: () => void;
  /** 返回入口（例如应用侧传 `<Link to="/">返回岗位看板</Link>`）；组件本身不依赖 router */
  home?: ReactNode;
}

/** 页面级错误提示：标题 + 错误信息 + 重试 / 返回。应用侧包一层接 ErrorComponentProps。 */
export function ErrorPanel({ error, onRetry, home }: ErrorPanelProps) {
  return (
    <div className="flex flex-col items-start gap-3 px-4 py-10 sm:px-8">
      <p className="font-heading text-xl">页面加载失败</p>
      <p className="text-sm text-neutral-700">{error instanceof Error ? error.message : "请求失败，请稍后重试"}</p>
      {onRetry && <Button onClick={onRetry}>重试</Button>}
      {home && <div className="text-sm text-accent-700 [&_a]:underline-offset-2 [&_a:hover]:underline">{home}</div>}
    </div>
  );
}
