import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** 合并 Tailwind 类名：clsx 处理条件表达式，tailwind-merge 消除冲突（后者覆盖前者）。 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
