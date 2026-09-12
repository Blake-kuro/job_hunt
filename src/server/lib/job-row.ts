import { isCategoryId, type CategoryId } from "@entities/job";
import { keyToDate, keyToInstant } from "./dates";
import { parseDeadline, splitGradDegree } from "./parse";

export type RawRow = Record<string, string>;

export interface JobUpsertInput {
  serialNumber: string | null;
  categoryId: CategoryId;
  recruitmentBatch: string | null;
  enterpriseNature: string | null;
  industry: string | null;
  workLocation: string | null;
  position: string;
  enterpriseName: string;
  graduationYear: string | null;
  degree: string | null;
  announcementLink: string | null;
  deliveryAddress: string | null;
  deadline: string | null;
  deadlineAt: Date | null;
  createTime?: Date;
}

export type MapResult =
  | { ok: true; data: JobUpsertInput; key: { id?: number; serialNumber?: string } }
  | { ok: false; reason: string };

export function categoryFromSheetName(name: string): CategoryId | null {
  if (name.includes("央国企")) return 2;
  if (name.includes("外企")) return 3;
  if (name.includes("秋招") || name.includes("实习")) return 1;
  return null;
}

function opt(v: string | undefined): string | null {
  const s = v?.trim();
  return s ? s : null;
}

function resolveCategory(raw: RawRow, sheetName: string): CategoryId | null {
  const n = Number(raw.categoryId);
  if (raw.categoryId && Number.isInteger(n) && isCategoryId(n)) return n;
  return categoryFromSheetName(sheetName);
}

export function mapJobRow(raw: RawRow, sheetName: string, todayKey: string): MapResult {
  const enterpriseName = opt(raw.enterpriseName);
  const position = opt(raw.position);
  if (!enterpriseName) return { ok: false, reason: "缺少 enterpriseName" };
  if (!position) return { ok: false, reason: "缺少 position" };

  const categoryId = resolveCategory(raw, sheetName);
  if (!categoryId) return { ok: false, reason: `无法确定分类：行内无 categoryId，表名「${sheetName}」也不含关键字` };

  const { graduationYear, degree } = splitGradDegree(raw.graduationYear);
  const finalDegree = opt(raw.degree) ?? degree;

  const deadline = opt(raw.deadline);
  const deadlineKey = parseDeadline(deadline, todayKey);
  const createKey = parseDeadline(opt(raw.createTime), todayKey);

  const key: { id?: number; serialNumber?: string } = {};
  const idNum = Number(raw.id);
  if (raw.id && Number.isInteger(idNum) && idNum > 0) key.id = idNum;
  else if (opt(raw.serialNumber)) key.serialNumber = raw.serialNumber.trim();

  return {
    ok: true,
    key,
    data: {
      serialNumber: opt(raw.serialNumber),
      categoryId,
      recruitmentBatch: opt(raw.recruitmentBatch),
      enterpriseNature: opt(raw.enterpriseNature),
      industry: opt(raw.industry),
      workLocation: opt(raw.workLocation),
      position,
      enterpriseName,
      graduationYear,
      degree: finalDegree,
      announcementLink: opt(raw.announcementLink),
      deliveryAddress: opt(raw.deliveryAddress),
      deadline,
      deadlineAt: deadlineKey ? keyToDate(deadlineKey) : null,
      ...(createKey && { createTime: keyToInstant(createKey) }),
    },
  };
}
