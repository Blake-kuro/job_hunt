import type ExcelJS from "exceljs";
import type { AdminImportResult } from "../contract";
import { prisma } from "../db";
import { dateKey } from "./dates";
import { cellText, loadWorkbook, WorkbookParseError } from "./excel";
import { mapJobRow, type RawRow } from "./job-row";

export { WorkbookParseError };

type SheetResult = AdminImportResult["sheets"][number];

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
  const wb = await loadWorkbook(buffer);

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
