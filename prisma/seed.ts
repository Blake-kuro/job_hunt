import "../src/load-env";
import { prisma } from "../src/db";
import { CATEGORIES, COMPANY_SETS, QUESTIONS } from "./quiz-data";

const DEV_USER_EMAIL = "dev@local";

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
  for (const c of CATEGORIES) {
    await prisma.questionCategory.upsert({ where: { id: c.id }, update: { name: c.name }, create: c });
  }
  for (const s of COMPANY_SETS) {
    await prisma.companySet.upsert({
      where: { id: s.id },
      update: { company: s.company, track: s.track, focus: s.focus },
      create: s,
    });
  }
  for (const item of QUESTIONS) {
    const data = {
      categoryId: item.categoryId,
      companySetId: item.companySetId ?? null,
      prompt: item.prompt,
      options: item.options.map((text, i) => ({ letter: LETTERS[i], text })),
      answer: item.answer,
      explanation: item.explanation,
      difficulty: item.difficulty,
      source: item.source,
    };
    await prisma.question.upsert({ where: { id: item.id }, update: data, create: { id: item.id, ...data } });
  }
  console.log(`题库就绪：${CATEGORIES.length} 个分类，${COMPANY_SETS.length} 个题集，${QUESTIONS.length} 道题`);
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
