import "../src/load-env";
import { prisma } from "../src/db";

const DEV_USER_EMAIL = "dev@local";

async function seedUser() {
  await prisma.user.upsert({
    where: { email: DEV_USER_EMAIL },
    update: {},
    create: { email: DEV_USER_EMAIL, name: "开发账号" },
  });
  console.log(`用户 ${DEV_USER_EMAIL} 就绪`);
}

async function main() {
  await seedUser();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
