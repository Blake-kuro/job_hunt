/** 秒 → `1 小时 20 分` / `2 小时` / `35 分钟` / `< 1 分钟`；null / 非法值视为 0 */
export function formatDuration(seconds: number | null | undefined): string {
  const total = Math.max(0, Math.floor(Number.isFinite(seconds) ? (seconds as number) : 0));
  if (total < 60) return "< 1 分钟";
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (hours === 0) return `${minutes} 分钟`;
  return minutes === 0 ? `${hours} 小时` : `${hours} 小时 ${minutes} 分`;
}

/** 分 → `¥199` / `¥19.9` / `¥0.05`；0 → `免费` */
export function formatPrice(priceCents: number): string {
  if (priceCents <= 0) return "免费";
  const yuan = priceCents / 100;
  return `¥${Number.isInteger(yuan) ? yuan : yuan.toFixed(2).replace(/0$/, "")}`;
}
