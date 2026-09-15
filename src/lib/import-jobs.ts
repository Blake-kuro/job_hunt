import ExcelJS from "exceljs";
import type { AdminImportResult } from "../contract";
import { prisma } from "../db";
import { dateKey } from "./dates";
import { mapJobRow, type RawRow } from "./job-row";

/** Excel 文件无法解析（损坏 / 非 xlsx / 无工作表） */
export class WorkbookParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkbookParseError";
  }
}

type SheetResult = AdminImportResult["sheets"][number];

function cellText(cell: ExcelJS.Cell): string {
  const v = cell.value;
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return dateKey(v);
  if (typeof v === "object" && "hyperlink" in v && typeof v.hyperlink === "string") return v.hyperlink;
  return cell.text ?? String(v);
}

async function importSheet(ws: ExcelJS.Worksheet, today: string): Promise<{ sheet: SheetResult; usedIdKey: boolean }> {
  const headerRow = ws.getRow(1);
  const headers: (string | null)[] = [];
  headerRow.eachCell({ includeEmpty: true }, (cell, col) => {
    headers[col] = cellText(cell).trim() || null;
  });

  let created = 0;
  let updated = 0;
  let usedIdKey = false;
  const skipped: string[] = [];

  const rows: { n: number; raw: RawRow }[] = [];
  ws.eachRow((row, n) => {
    if (n === 1) return;
    const raw: RawRow = {};
    headers.forEach((h, col) => {
      if (h) raw[h] = cellText(row.getCell(col));
    });
    if (Object.values(raw).every((v) => !v.trim())) return;
    rows.push({ n, raw });
  });

  for (const { n, raw } of rows) {
    const r = mapJobRow(raw, ws.name, today);
    if (!r.ok) {
      skipped.push(`第 ${n} 行：${r.reason}`);
      continue;
    }
    const { data, key } = r;

    if (key.id !== undefined) {
      usedIdKey = true;
      const exists = await prisma.job.findUnique({ where: { id: key.id }, select: { id: true } });
      await prisma.job.upsert({ where: { id: key.id }, update: data, create: { id: key.id, ...data } });
      if (exists) updated++;
      else created++;
    } else if (key.serialNumber !== undefined) {
      const exists = await prisma.job.findFirst({ where: { serialNumber: key.serialNumber }, select: { id: true } });
      if (exists) {
        await prisma.job.update({ where: { id: exists.id }, data });
        updated++;
      } else {
        await prisma.job.create({ data });
        created++;
      }
    } else {
      await prisma.job.create({ data });
      created++;
    }
  }

  return { sheet: { name: ws.name, created, updated, skipped }, usedIdKey };
}

/**
 * 导入一个 xlsx 工作簿的全部工作表。
 * 若有按 id 列 upsert 过，会自动把 Job.id 的自增序列同步到当前最大值。
 */
export async function importWorkbook(buffer: ArrayBuffer | Buffer, todayKey = dateKey()): Promise<AdminImportResult> {
  const wb = new ExcelJS.Workbook();
  const bytes = buffer instanceof ArrayBuffer ? Buffer.from(buffer) : buffer;
  try {
    // exceljs 的 .d.ts 里 Buffer 是自定义的 ArrayBuffer 别名，运行时实际要 Node Buffer
    await wb.xlsx.load(bytes as unknown as Parameters<typeof wb.xlsx.load>[0]);
  } catch (e) {
    throw new WorkbookParseError(e instanceof Error ? e.message : String(e));
  }
  if (wb.worksheets.length === 0) throw new WorkbookParseError("文件里没有工作表");

  let usedIdKey = false;
  const sheets: AdminImportResult["sheets"] = [];
  for (const ws of wb.worksheets) {
    const r = await importSheet(ws, todayKey);
    usedIdKey ||= r.usedIdKey;
    sheets.push(r.sheet);
  }
  if (usedIdKey) {
    await prisma.$executeRawUnsafe(
      `SELECT setval(pg_get_serial_sequence('"Job"', 'id'), (SELECT COALESCE(MAX(id), 1) FROM "Job"))`,
    );
  }
  return { sheets, usedIdKey };
}
