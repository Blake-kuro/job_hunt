import "../src/load-env";
import { prisma } from "../src/db";

const [phone, plan, daysArg] = process.argv.slice(2);
if (!phone || (plan !== "FREE" && plan !== "PRO")) {
  console.error("用法：pnpm set-plan <手机号> <FREE|PRO> [天数]");
  process.exit(1);
}
const days = daysArg ? Number(daysArg) : null;
if (daysArg && (!Number.isInteger(days) || (days as number) <= 0)) {
  console.error("天数必须是正整数");
  process.exit(1);
}

const identity = await prisma.authIdentity.findUnique({
  where: { provider_providerKey: { provider: "PHONE", providerKey: phone } },
  select: { userId: true },
});
if (!identity) {
  console.error(`手机号 ${phone} 尚未登录过，没有对应用户`);
  process.exit(1);
}
const proExpiresAt = plan === "PRO" && days ? new Date(Date.now() + days * 86_400_000) : null;
const user = await prisma.user.update({
  where: { id: identity.userId },
  data: { plan, proExpiresAt },
  select: { id: true, name: true, plan: true, proExpiresAt: true },
});
console.log(
  `${user.name}（${phone}）→ ${user.plan}${user.proExpiresAt ? `，到期 ${user.proExpiresAt.toISOString().slice(0, 10)}` : plan === "PRO" ? "（永久）" : ""}`,
);
await prisma.$disconnect();
