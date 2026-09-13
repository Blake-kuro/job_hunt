const TZ = "Asia/Shanghai";
const DAY_MS = 86_400_000;

const keyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** 上海时区下的 "YYYY-MM-DD" */
export function dateKey(d: Date = new Date()): string {
  return keyFormatter.format(d);
}

/** UTC 零点；和 @db.Date 列比较时用 */
export function keyToDate(key: string): Date {
  return new Date(`${key}T00:00:00Z`);
}

/** @db.Date 列读出的 Date（UTC 零点）转回 "YYYY-MM-DD"；keyToDate 的逆 */
export function dbDateToKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** 上海零点的真实时刻；和 DateTime 列比较时用 */
export function keyToInstant(key: string): Date {
  return new Date(`${key}T00:00:00+08:00`);
}

export function addDays(key: string, n: number): string {
  return new Date(keyToDate(key).getTime() + n * DAY_MS).toISOString().slice(0, 10);
}

export function daysBetween(fromKey: string, toKey: string): number {
  return Math.round((keyToDate(toKey).getTime() - keyToDate(fromKey).getTime()) / DAY_MS);
}

export function weekStartKey(key: string): string {
  const dow = keyToDate(key).getUTCDay(); // 0 = 周日
  const back = (dow + 6) % 7;
  return addDays(key, -back);
}

export function computeStreak(keys: Set<string>, todayKey: string): number {
  let cursor = keys.has(todayKey) ? todayKey : addDays(todayKey, -1);
  let n = 0;
  while (keys.has(cursor)) {
    n += 1;
    cursor = addDays(cursor, -1);
  }
  return n;
}

export function dueLabel(nextReviewAt: Date, todayKey: string): string {
  const diff = daysBetween(todayKey, dateKey(nextReviewAt));
  if (diff < 0) return "已到期";
  if (diff === 0) return "今天";
  if (diff === 1) return "明天";
  return `${diff} 天后`;
}
