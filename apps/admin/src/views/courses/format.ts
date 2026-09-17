/** 分 → 展示价格；0 为免费 */
export function formatPrice(cents: number): string {
  return cents === 0 ? "免费" : `¥${(cents / 100).toFixed(2)}`;
}

/** 秒 → mm:ss / h:mm:ss */
export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  return `${h > 0 ? `${h}:` : ""}${mm}:${String(sec).padStart(2, "0")}`;
}

/** ISO → 本地日期（yyyy/M/d） */
export function formatDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString("zh-CN") : "—";
}
