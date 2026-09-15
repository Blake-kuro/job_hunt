-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('FREE', 'PRO');

-- AlterEnum
ALTER TYPE "AuthProvider" ADD VALUE 'DEVICE';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "plan" "Plan" NOT NULL DEFAULT 'FREE',
ADD COLUMN     "proExpiresAt" TIMESTAMP(3);
