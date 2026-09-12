import "dotenv/config";
import ExcelJS from "exceljs";
import { prisma } from "../src/server/db";
import { dateKey } from "../src/server/lib/dates";
import { mapJobRow, type RawRow } from "../src/server/lib/job-row";

function cellText(cell: ExcelJS.Cell): string {
  const v = cell.value;
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return `${v.getFullYear()}/${v.getMonth() + 1}/${v.getDate()}`;
  if (typeof v === "object" && "hyperlink" in v && typeof v.hyperlink === "string") return v.hyperlink;
  return cell.text ?? String(v);
}

async function importSheet(ws: ExcelJS.Worksheet, today: string) {
  const headerRow = ws.getRow(1);
  const headers: (string | null)[] = [];
  headerRow.eachCell({ includeEmpty: true }, (cell, col) => {
    headers[col] = cellText(cell).trim() || null;
  });

  let created = 0;
  let updated = 0;
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
      const exists = await prisma.job.findUnique({ where: { id: key.id }, select: { id: true } });
      await prisma.job.upsert({ where: { id: key.id }, update: data, create: { id: key.id, ...data } });
      exists ? updated++ : created++;
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

  console.log(`${ws.name}：新增 ${created} · 更新 ${updated} · 跳过 ${skipped.length}`);
  for (const s of skipped) console.log(`  - ${s}`);
}

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error("用法：npm run db:import -- <文件.xlsx>");
    process.exit(1);
  }
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  const today = dateKey();
  for (const ws of wb.worksheets) await importSheet(ws, today);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
