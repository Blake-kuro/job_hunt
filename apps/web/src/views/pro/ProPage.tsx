import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { meQuery } from "@api/queries";
import { Button } from "@job-hunt/ui/components/button";
import { Kicker } from "@job-hunt/ui/components/kicker";
import { Badge } from "@job-hunt/ui/components/badge";
import { Navbar } from "@widgets/navbar/Navbar";

const ROWS = [
  { label: "岗位公告", guest: "前 20 条", free: "前 100 条", pro: "全部" },
  { label: "题库", guest: "前 20 道", free: "前 200 道", pro: "全部" },
  { label: "收藏 / 投递 / 错题本", guest: "✓", free: "✓", pro: "✓" },
];

export function ProPage() {
  const { data: user } = useSuspenseQuery(meQuery());
  return (
    <div className="flex min-h-full flex-col bg-bg">
      <Navbar active="jobs" />
      <section className="px-4 py-10 sm:px-8">
        <Kicker className="text-accent-700">PRO</Kicker>
        <h1 className="mt-2 text-[32px] sm:text-[44px]">解锁全部岗位与题库</h1>
        <p className="mt-3 max-w-[640px] text-[15px] text-neutral-700">
          当前档位：
          <Badge variant={user.tier === "PRO" ? "accent" : "neutral"}>
            {user.tier === "PRO" ? "PRO" : user.tier === "FREE" ? "免费账号" : "游客"}
          </Badge>
        </p>
        <div className="mt-8 max-w-[760px] overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead className="text-left text-xs text-neutral-700">
              <tr>
                <th className="py-2">权益</th>
                <th>游客</th>
                <th>免费</th>
                <th className="text-accent-700">PRO</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r) => (
                <tr key={r.label} className="border-t border-divider">
                  <td className="py-3 font-medium">{r.label}</td>
                  <td>{r.guest}</td>
                  <td>{r.free}</td>
                  <td className="text-accent-800">{r.pro}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-8 max-w-[640px] border border-divider p-5">
          <p className="font-heading text-lg">如何开通</p>
          <p className="mt-2 text-sm leading-relaxed text-neutral-700">
            公司注册手续办理中，在线支付尚未开放。现阶段请添加微信 <b>（待填写）</b>{" "}
            联系开通，我们会在核对后为你的手机号开启 PRO。
          </p>
          {user.tier === "GUEST" && (
            <Button asChild variant="primary" size="lg" blueprint className="mt-4">
              <Link to="/login">先登录</Link>
            </Button>
          )}
        </div>
      </section>
    </div>
  );
}
