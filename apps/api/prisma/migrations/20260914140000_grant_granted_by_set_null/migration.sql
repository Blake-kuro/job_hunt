-- DropForeignKey
ALTER TABLE "AccessGrant" DROP CONSTRAINT "AccessGrant_grantedById_fkey";

-- AlterTable
ALTER TABLE "AccessGrant" ALTER COLUMN "grantedById" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "AccessGrant" ADD CONSTRAINT "AccessGrant_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

