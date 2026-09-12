import { dateKey, daysBetween } from "./dates";

const SEPARATORS = /[、，,\/|\s]+/;

export function splitMulti(text: string | null | undefined): string[] {
  if (!text) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of text.split(SEPARATORS)) {
    const s = raw.trim();
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

function pad(n: string): string {
  return n.padStart(2, "0");
}

/** 返回 "YYYY-MM-DD" 或 null。todayKey 只在测试里传，生产用当天。 */
export function parseDeadline(text: string | null | undefined, todayKey: string = dateKey()): string | null {
  if (!text) return null;
  const s = text.trim();

  const withYear = s.match(/(\d{4})\s*[./\-年]\s*(\d{1,2})\s*[./\-月]\s*(\d{1,2})\s*日?/);
  if (withYear) {
    const [, y, m, d] = withYear;
    return `${y}-${pad(m)}-${pad(d)}`;
  }

  const noYear = s.match(/(?<!\d)(\d{1,2})\s*[./\-月]\s*(\d{1,2})\s*日?(?!\d)/);
  if (noYear) {
    const [, m, d] = noYear;
    const year = Number(todayKey.slice(0, 4));
    const candidate = `${year}-${pad(m)}-${pad(d)}`;
    if (daysBetween(candidate, todayKey) > 180) {
      return `${year + 1}-${pad(m)}-${pad(d)}`;
    }
    return candidate;
  }

  return null;
}

const DEGREE_HINT = /及以上|本科|硕士|博士|不限|大专|研究生/;

export function splitGradDegree(cell: string | null | undefined): { graduationYear: string | null; degree: string | null } {
  if (!cell) return { graduationYear: null, degree: null };
  let graduationYear: string | null = null;
  let degree: string | null = null;
  for (const raw of cell.split(/\r?\n/)) {
    const s = raw.trim();
    if (!s) continue;
    if (s.includes("届")) {
      graduationYear ??= s;
    } else if (DEGREE_HINT.test(s)) {
      degree ??= s;
    }
  }
  return { graduationYear, degree };
}
