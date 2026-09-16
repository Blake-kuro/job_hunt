import "../src/load-env";
import { readFileSync } from "node:fs";
import { prisma } from "../src/db";
import { importQuestionWorkbook } from "../src/lib/import-questions";

async function main() {
  const [companyName, categoryName, file] = process.argv.slice(2).filter((arg) => arg !== "--");
  if (!companyName || !categoryName || !file) {
    console.error("用法：pnpm db:import-questions <公司名> <分类名> <文件.xlsx>");
    process.exit(1);
  }
  const company = await prisma.company.upsert({
    where: { name: companyName },
    update: {},
    create: { name: companyName },
  });
  const category = await prisma.questionCategory.upsert({
    where: { companyId_name: { companyId: company.id, name: categoryName } },
    update: {},
    create: { companyId: company.id, name: categoryName },
  });
  const result = await importQuestionWorkbook(category.id, readFileSync(file));
  console.log(`${company.name} · ${category.name}：新增 ${result.created} · 跳过 ${result.skipped.length}`);
  for (const s of result.skipped) console.log(`  - ${s}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
