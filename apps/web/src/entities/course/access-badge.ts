import type { CourseCard } from "@job-hunt/api-client/types";
import { formatPrice } from "./format-duration";

/** 卡片右上角标签：免费 / 已开通 / 可试看 / ¥价格 */
export function accessBadge(course: Pick<CourseCard, "access" | "priceCents">): {
  label: string;
  variant: "accent" | "neutral" | "outline";
} {
  if (course.priceCents === 0) return { label: "免费", variant: "accent" };
  if (course.access === "GRANTED") return { label: "已开通", variant: "accent" };
  if (course.access === "PREVIEW") return { label: "可试看", variant: "outline" };
  return { label: formatPrice(course.priceCents), variant: "neutral" };
}
