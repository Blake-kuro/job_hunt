import type { CategoryId } from "@api/types";

export const CATEGORY: Record<CategoryId, string> = { 1: "秋招与实习", 2: "央国企", 3: "外企" };

export const CATEGORY_OPTIONS = [
  { value: "all", label: "全部" },
  { value: "1", label: CATEGORY[1] },
  { value: "2", label: CATEGORY[2] },
  { value: "3", label: CATEGORY[3] },
] as const;

export function isCategoryId(n: number): n is CategoryId {
  return n === 1 || n === 2 || n === 3;
}
