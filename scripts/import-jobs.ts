import "../src/load-env";
import { readFileSync } from "node:fs";
import { prisma } from "../src/db";
import { importWorkbook } from "../src/lib/import-jobs";

async function main() {
  const file = process.argv.slice(2).find((arg) => arg !== "--");
  if (!file) {
    console.error("用法：pnpm db:import -- <文件.xlsx>");
    process.exit(1);
  }
  const result = await importWorkbook(readFileSync(file));
  for (const sheet of result.sheets) {
    console.log(`${sheet.name}：新增 ${sheet.created} · 更新 ${sheet.updated} · 跳过 ${sheet.skipped.length}`);
    for (const s of sheet.skipped) console.log(`  - ${s}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
