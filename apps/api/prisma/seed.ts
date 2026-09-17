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

/** 一门免费示例课（固定 id，可重复执行）：2 章 3 课时，视频状态 READY，fileId 为 mock 值，只在 VOD_MOCK 下可播 */
const SAMPLE_COURSE = {
  id: "course-sample-free",
  title: "求职入门示例课",
  summary: "免费示例课，用于本地联调播放与进度",
  description: "这是一门免费示例课。\n视频 fileId 是 mock 值，只在后端 VOD_MOCK=1 时可播放。",
  teacher: "职寻教研组",
  priceCents: 0,
  published: true,
  sortOrder: 0,
} as const;
const SAMPLE_CHAPTERS = [
  { id: "chapter-sample-1", title: "第一章 · 简历", sortOrder: 0 },
  { id: "chapter-sample-2", title: "第二章 · 面试", sortOrder: 1 },
] as const;
const SAMPLE_LESSONS = [
  {
    id: "lesson-sample-1",
    chapterId: "chapter-sample-1",
    title: "简历结构与要点",
    sortOrder: 0,
    videoFileId: "mock-1",
  },
  {
    id: "lesson-sample-2",
    chapterId: "chapter-sample-1",
    title: "项目经历怎么写",
    sortOrder: 1,
    videoFileId: "mock-2",
  },
  { id: "lesson-sample-3", chapterId: "chapter-sample-2", title: "自我介绍模板", sortOrder: 2, videoFileId: "mock-3" },
] as const;

async function seedCourse() {
  const { id, ...course } = SAMPLE_COURSE;
  await prisma.course.upsert({ where: { id }, update: course, create: { id, ...course } });
  for (const { id: chapterId, ...chapter } of SAMPLE_CHAPTERS) {
    const data = { ...chapter, courseId: id };
    await prisma.courseChapter.upsert({ where: { id: chapterId }, update: data, create: { id: chapterId, ...data } });
  }
  for (const { id: lessonId, ...lesson } of SAMPLE_LESSONS) {
    const data = { ...lesson, courseId: id, freePreview: true, videoStatus: "READY" as const, durationSeconds: 600 };
    await prisma.courseLesson.upsert({ where: { id: lessonId }, update: data, create: { id: lessonId, ...data } });
  }
  console.log(`示例课就绪：${SAMPLE_COURSE.title}（${SAMPLE_CHAPTERS.length} 章 ${SAMPLE_LESSONS.length} 课时）`);
}

async function main() {
  await seedUser();
  await seedQuiz();
  if (process.env.VOD_MOCK === "1") await seedCourse();
  else console.log("跳过示例课：VOD_MOCK 不是 1（示例课的 videoFileId 是 mock 值，真实 VOD 下不可播，不应种到生产）");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
