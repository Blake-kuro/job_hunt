import { ApiError } from "@job-hunt/api-client/client";
import { Button } from "@job-hunt/ui/components/button";
import { useQueryClient } from "@tanstack/react-query";
import { type ErrorComponentProps, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useLogout } from "@api/mutations";
import { RouterErrorPanel } from "../../routes/-error";

const isAuthError = (error: unknown): error is ApiError =>
  error instanceof ApiError && (error.status === 401 || error.status === 403);

/** 受保护页面出错：会话失效 / 账号被停用时清缓存回登录页；其他错误交给 ErrorPanel */
export function AdminErrorPanel(props: ErrorComponentProps) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const authError = isAuthError(props.error);
  useEffect(() => {
    if (!authError) return;
    qc.clear();
    void navigate({ to: "/login", search: { reason: "forbidden" }, replace: true });
  }, [authError, qc, navigate]);
  if (authError) {
    return (
      <p role="status" className="px-6 py-8 text-sm text-neutral-700">
        登录状态已失效，正在返回登录页…
      </p>
    );
  }
  return <RouterErrorPanel {...props} />;
}

/** 登录页本身取不到当前用户（账号被停用会 403）：给一个退出入口换号 */
export function LoginErrorPanel(props: ErrorComponentProps) {
  const navigate = useNavigate();
  const logout = useLogout();
  const { error } = props;
  if (!isAuthError(error)) return <RouterErrorPanel {...props} />;
  return (
    <div className="flex flex-col items-start gap-3 px-6 py-10">
      <p className="font-heading text-xl">当前账号无法使用管理后台</p>
      <p className="text-sm text-neutral-700">{error.message}</p>
      <Button
        variant="primary"
        disabled={logout.isPending}
        onClick={async () => {
          await logout.mutateAsync();
          props.reset();
          await navigate({ to: "/login", search: {}, replace: true });
        }}
      >
        退出当前账号
      </Button>
    </div>
  );
}
