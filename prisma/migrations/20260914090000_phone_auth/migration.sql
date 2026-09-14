ALTER TABLE "User" ALTER COLUMN "email" DROP NOT NULL;

CREATE TYPE "AuthProvider" AS ENUM ('PHONE', 'WECHAT', 'QQ');
CREATE TABLE "AuthIdentity" (
    "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "provider" "AuthProvider" NOT NULL,
    "providerKey" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuthIdentity_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Session" (
    "tokenHash" TEXT NOT NULL, "userId" TEXT NOT NULL, "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Session_pkey" PRIMARY KEY ("tokenHash")
);
CREATE TABLE "SmsVerification" (
    "id" TEXT NOT NULL, "phone" TEXT NOT NULL, "codeHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0, "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SmsVerification_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AuthIdentity_provider_providerKey_key" ON "AuthIdentity"("provider", "providerKey");
CREATE INDEX "AuthIdentity_userId_idx" ON "AuthIdentity"("userId");
CREATE INDEX "Session_userId_idx" ON "Session"("userId");
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");
CREATE INDEX "SmsVerification_phone_createdAt_idx" ON "SmsVerification"("phone", "createdAt");
CREATE INDEX "SmsVerification_expiresAt_idx" ON "SmsVerification"("expiresAt");
ALTER TABLE "AuthIdentity" ADD CONSTRAINT "AuthIdentity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
