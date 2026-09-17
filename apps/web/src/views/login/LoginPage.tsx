import { useEffect, useState } from "react";
import { getRouteApi } from "@tanstack/react-router";
import { useSendLoginSms, useVerifyLoginSms } from "@api/mutations";
import { Button } from "@job-hunt/ui/components/button";
import { Input } from "@job-hunt/ui/components/input";
import { Kicker } from "@job-hunt/ui/components/kicker";

const route = getRouteApi("/login");
const phonePattern = /^1[3-9]\d{9}$/;

export function LoginPage() {
  const { redirect: redirectTo } = route.useSearch();
  const sendSms = useSendLoginSms();
  const verifySms = useVerifyLoginSms();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [localError, setLocalError] = useState("");

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = window.setInterval(() => setCountdown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [countdown]);

  async function requestCode() {
    setLocalError("");
    if (!phonePattern.test(phone)) {
      setLocalError("请输入有效的 11 位大陆手机号");
      return;
    }
    try {
      const result = await sendSms.mutateAsync(phone);
      setSent(true);
      setCountdown(result.retryAfter);
      if (result.developmentCode) setCode(result.developmentCode);
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : "验证码发送失败，请稍后重试");
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLocalError("");
    if (!sent) {
      await requestCode();
      return;
    }
    if (!/^\d{6}$/.test(code)) {
      setLocalError("请输入 6 位验证码");
      return;
    }
    try {
      await verifySms.mutateAsync({ phone, code });
      const destination = redirectTo?.startsWith("/") && !redirectTo.startsWith("//") ? redirectTo : "/";
      window.location.replace(destination);
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : "登录失败，请重试");
    }
  }

  const error = localError || sendSms.error?.message || verifySms.error?.message;

  return (
    <main className="grid min-h-full bg-bg lg:grid-cols-[minmax(360px,0.9fr)_minmax(520px,1.1fr)]">
      <section className="relative hidden overflow-hidden border-r border-divider bg-accent-900 p-12 text-accent-100 lg:flex lg:flex-col">
        <div className="absolute -right-32 -top-24 size-96 rounded-full border border-accent-500/30" />
        <div className="absolute -right-10 top-10 size-64 rounded-full border border-accent-400/25" />
        <div className="flex items-center gap-3 font-heading text-xl font-semibold text-white">
          <span className="size-4 bg-accent-400" />
          职寻 <span className="text-[10px] tracking-[0.22em] text-accent-300">CAMPUS</span>
        </div>
        <div className="my-auto max-w-lg">
          <Kicker className="mb-5 text-accent-300">你的校招工作台</Kicker>
          <h1 className="text-balance text-5xl leading-[1.08] text-white xl:text-6xl">机会很多，进度不能乱。</h1>
          <p className="mt-6 max-w-md text-base leading-7 text-accent-200">
            收藏岗位、跟踪投递、坚持刷题。你的记录会安全地保存在同一个账号里。
          </p>
        </div>
        <p className="text-xs tracking-wide text-accent-400">JOB HUNTING, ORGANIZED.</p>
      </section>

      <section className="flex min-h-full items-center justify-center px-5 py-12 sm:px-10">
        <div className="w-full max-w-[420px]">
          <div className="mb-10 flex items-center gap-2.5 font-heading text-lg font-semibold lg:hidden">
            <span className="size-4 bg-accent" />
            职寻
          </div>
          <Kicker className="mb-3 text-accent-700">手机号登录</Kicker>
          <h2 className="text-4xl sm:text-[44px]">欢迎回来</h2>
          <p className="mt-3 text-sm text-neutral-700">未注册的手机号验证后将自动创建账号。</p>

          <form className="mt-9 space-y-5" onSubmit={submit} noValidate>
            <label className="block" htmlFor="phone">
              <span className="mb-2 block text-xs font-medium text-neutral-800">手机号</span>
              <div className="flex min-h-12 items-center border border-divider bg-surface focus-within:border-accent">
                <span className="border-r border-divider px-3.5 text-sm text-neutral-700">+86</span>
                <Input
                  id="phone"
                  autoFocus
                  autoComplete="tel"
                  inputMode="numeric"
                  maxLength={11}
                  value={phone}
                  onChange={(event) => setPhone(event.target.value.replace(/\D/g, ""))}
                  disabled={sent}
                  placeholder="请输入手机号"
                  className="min-h-11 flex-1 border-0 bg-transparent px-3.5 disabled:opacity-100"
                />
                {sent && (
                  <button
                    type="button"
                    className="mr-3 cursor-pointer text-xs text-accent-700 disabled:cursor-not-allowed disabled:text-neutral-500"
                    disabled={countdown > 0 || sendSms.isPending}
                    onClick={requestCode}
                  >
                    {countdown > 0 ? `${countdown}s` : "重新获取"}
                  </button>
                )}
              </div>
            </label>

            {sent && (
              <label className="block" htmlFor="sms-code">
                <span className="mb-2 block text-xs font-medium text-neutral-800">短信验证码</span>
                <Input
                  id="sms-code"
                  autoFocus
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
                  placeholder="6 位验证码"
                  className="min-h-12 bg-surface px-3.5 text-base tracking-[0.35em]"
                />
                {sendSms.data?.developmentCode && (
                  <span className="mt-2 block text-xs text-neutral-600">
                    开发验证码已自动填入：{sendSms.data.developmentCode}
                  </span>
                )}
              </label>
            )}

            {error && (
              <p role="alert" className="border-l-2 border-red-600 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              blueprint
              disabled={sendSms.isPending || verifySms.isPending}
              className="min-h-12 w-full text-base"
            >
              {sendSms.isPending
                ? "正在发送…"
                : verifySms.isPending
                  ? "正在登录…"
                  : sent
                    ? "登录 / 注册"
                    : "获取验证码"}
            </Button>
          </form>

          <p className="mt-5 text-center text-xs leading-5 text-neutral-600">继续即表示你同意平台服务条款与隐私政策</p>
          <div className="mt-10 flex items-center gap-3 text-xs text-neutral-500">
            <span className="h-px flex-1 bg-divider" />
            微信与 QQ 登录即将开放
            <span className="h-px flex-1 bg-divider" />
          </div>
        </div>
      </section>
    </main>
  );
}
