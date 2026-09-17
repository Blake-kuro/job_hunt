CREATE TYPE "VideoStatus" AS ENUM ('NONE', 'UPLOADING', 'PROCESSING', 'READY', 'FAILED');
ALTER TABLE "Course" ADD COLUMN "summary" TEXT, ADD COLUMN "coverFileId" TEXT, ADD COLUMN "teacher" TEXT, ADD COLUMN "priceCents" INTEGER NOT NULL DEFAULT 0, ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;
CREATE TABLE "CourseChapter" ("id" TEXT NOT NULL, "courseId" TEXT NOT NULL, "title" TEXT NOT NULL, "sortOrder" INTEGER NOT NULL DEFAULT 0, CONSTRAINT "CourseChapter_pkey" PRIMARY KEY ("id"));
-- 旧课时：外链 videoUrl 改名为 legacyVideoUrl 保留；durationMinutes → durationSeconds（*60）；videoStatus 默认 NONE
ALTER TABLE "CourseLesson" RENAME COLUMN "videoUrl" TO "legacyVideoUrl";
ALTER TABLE "CourseLesson" ALTER COLUMN "legacyVideoUrl" DROP NOT NULL;
ALTER TABLE "CourseLesson" ADD COLUMN "chapterId" TEXT, ADD COLUMN "freePreview" BOOLEAN NOT NULL DEFAULT false, ADD COLUMN "videoFileId" TEXT, ADD COLUMN "videoStatus" "VideoStatus" NOT NULL DEFAULT 'NONE', ADD COLUMN "durationSeconds" INTEGER;
UPDATE "CourseLesson" SET "durationSeconds" = "durationMinutes" * 60 WHERE "durationMinutes" IS NOT NULL;
ALTER TABLE "CourseLesson" DROP COLUMN "durationMinutes";
CREATE TABLE "LessonProgress" ("userId" TEXT NOT NULL, "lessonId" TEXT NOT NULL, "courseId" TEXT NOT NULL, "positionSeconds" INTEGER NOT NULL DEFAULT 0, "completed" BOOLEAN NOT NULL DEFAULT false, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "LessonProgress_pkey" PRIMARY KEY ("userId", "lessonId"));
CREATE INDEX "CourseChapter_courseId_sortOrder_idx" ON "CourseChapter"("courseId", "sortOrder");
CREATE INDEX "CourseLesson_chapterId_idx" ON "CourseLesson"("chapterId");
CREATE INDEX "LessonProgress_userId_courseId_updatedAt_idx" ON "LessonProgress"("userId", "courseId", "updatedAt");
ALTER TABLE "CourseChapter" ADD CONSTRAINT "CourseChapter_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CourseLesson" ADD CONSTRAINT "CourseLesson_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "CourseChapter"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LessonProgress" ADD CONSTRAINT "LessonProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LessonProgress" ADD CONSTRAINT "LessonProgress_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "CourseLesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LessonProgress" ADD CONSTRAINT "LessonProgress_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
