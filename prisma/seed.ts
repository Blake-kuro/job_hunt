import "../src/load-env";
import { prisma } from "../src/db";
import { CATEGORIES, QUESTIONS } from "./quiz-data";

const DEV_USER_EMAIL = "dev@local";
const GENERAL_COMPANY = { id: "company-general", name: "通用题库" } as const;

async function seedUser() {
  await prisma.user.upsert({
    where: { email: DEV_USER_EMAIL },
    update: { role: "ADMIN" },
    create: { email: DEV_USER_EMAIL, name: "开发账号", role: "ADMIN" },
  });
  console.log(`用户 ${DEV_USER_EMAIL} 就绪`);
}

const LETTERS = ["A", "B", "C", "D"] as const;

async function seedQuiz() {
  await prisma.company.upsert({
    where: { id: GENERAL_COMPANY.id },
    update: { name: GENERAL_COMPANY.name },
    create: GENERAL_COMPANY,
  });
  for (const [i, c] of CATEGORIES.entries()) {
    await prisma.questionCategory.upsert({
      where: { id: c.id },
      update: { name: c.name, companyId: GENERAL_COMPANY.id, sortOrder: i + 1 },
      create: { ...c, companyId: GENERAL_COMPANY.id, sortOrder: i + 1 },
    });
  }
  const perCategory = new Map<string, number>();
  for (const item of QUESTIONS) {
    const sortOrder = (perCategory.get(item.categoryId) ?? 0) + 1;
    perCategory.set(item.categoryId, sortOrder);
    const data = {
      categoryId: item.categoryId,
      type: "SINGLE" as const,
      sortOrder,
      prompt: item.prompt,
      options: item.options.map((text, i) => ({ letter: LETTERS[i], text })),
      answer: item.answer,
      explanation: item.explanation,
      difficulty: item.difficulty,
      source: item.source,
    };
    await prisma.question.upsert({ where: { id: item.id }, update: data, create: { id: item.id, ...data } });
  }
  console.log(`题库就绪：1 个公司，${CATEGORIES.length} 个分类，${QUESTIONS.length} 道题`);
}

async function main() {
  await seedUser();
  await seedQuiz();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
