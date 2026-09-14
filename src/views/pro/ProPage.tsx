import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { meQuery } from "@api/queries";
import { cn } from "@shared/lib/cn";
import { Kicker } from "@shared/ui/Kicker";
import { Tag } from "@shared/ui/Tag";
import { Navbar } from "@widgets/navbar/Navbar";

const ROWS = [
  { label: "岗位公告", guest: "前 20 条", free: "前 100 条", pro: "全部" },
  { label: "题库", guest: "前 20 道", free: "前 200 道", pro: "全部" },
  { label: "收藏 / 投递 / 错题本", guest: "✓", free: "✓", pro: "✓" },
];

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
          <Tag variant={user.tier === "PRO" ? "accent" : "neutral"}>
            {user.tier === "PRO" ? "PRO" : user.tier === "FREE" ? "免费账号" : "游客"}
          </Tag>
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
            <Link to="/login" className={cn(primaryLgBlueprintClass, "mt-4")}>
              先登录
              <i className="corner tl" />
              <i className="corner tr" />
              <i className="corner bl" />
              <i className="corner br" />
            </Link>
          )}
        </div>
      </section>
    </div>
  );
}
