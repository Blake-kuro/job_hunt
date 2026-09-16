-- 公司 → 分类 → 题目：新增 Company 与 QuestionType，现有分类归入「通用题库」，删除 CompanySet

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('SINGLE', 'MULTI', 'JUDGE');

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Company_name_key" ON "Company"("name");

INSERT INTO "Company" ("id", "name", "sortOrder") VALUES ('company-general', '通用题库', 0);

-- QuestionCategory：加 companyId（先可空回填）与 sortOrder，唯一键改为 (companyId, name)
ALTER TABLE "QuestionCategory" ADD COLUMN "companyId" TEXT,
ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;
UPDATE "QuestionCategory" SET "companyId" = 'company-general';
ALTER TABLE "QuestionCategory" ALTER COLUMN "companyId" SET NOT NULL;

-- DropIndex
DROP INDEX "QuestionCategory_name_key";

-- CreateIndex
CREATE UNIQUE INDEX "QuestionCategory_companyId_name_key" ON "QuestionCategory"("companyId", "name");

-- AddForeignKey
ALTER TABLE "QuestionCategory" ADD CONSTRAINT "QuestionCategory_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Question：加 type / section / sortOrder，difficulty 默认 MEDIUM，分类外键改级联，删 companySetId
ALTER TABLE "Question"
ADD COLUMN "type" "QuestionType" NOT NULL DEFAULT 'SINGLE',
ADD COLUMN "section" TEXT,
ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;
UPDATE "Question" q SET "sortOrder" = s.rn FROM (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "categoryId" ORDER BY "id") AS rn FROM "Question"
) s WHERE q."id" = s."id";
ALTER TABLE "Question" ALTER COLUMN "difficulty" SET DEFAULT 'MEDIUM';

-- DropForeignKey
ALTER TABLE "Question" DROP CONSTRAINT "Question_categoryId_fkey";

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "QuestionCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DropForeignKey
ALTER TABLE "Question" DROP CONSTRAINT "Question_companySetId_fkey";

-- AlterTable
ALTER TABLE "Question" DROP COLUMN "companySetId";

-- DropTable
DROP TABLE "CompanySet";

-- CreateIndex
CREATE INDEX "Question_categoryId_sortOrder_idx" ON "Question"("categoryId", "sortOrder");
