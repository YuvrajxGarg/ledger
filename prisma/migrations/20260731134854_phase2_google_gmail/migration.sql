-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN "matchConfidence" INTEGER;
ALTER TABLE "Invoice" ADD COLUMN "sourceSubject" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN "gmailLastScanAt" DATETIME;
ALTER TABLE "User" ADD COLUMN "googleAccessToken" TEXT;
ALTER TABLE "User" ADD COLUMN "googleId" TEXT;
ALTER TABLE "User" ADD COLUMN "googleRefreshToken" TEXT;
ALTER TABLE "User" ADD COLUMN "googleTokenExpiry" DATETIME;
ALTER TABLE "User" ADD COLUMN "image" TEXT;
