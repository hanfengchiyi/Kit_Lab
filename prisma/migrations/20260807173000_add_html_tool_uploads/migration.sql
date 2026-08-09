-- AlterTable
ALTER TABLE "User" ADD COLUMN "htmlStorageUsedBytes" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Tool" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'link';
ALTER TABLE "Tool" ADD COLUMN "htmlEntry" TEXT;
ALTER TABLE "Tool" ADD COLUMN "htmlBytes" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Tool" ADD COLUMN "htmlAccessToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Tool_htmlAccessToken_key" ON "Tool"("htmlAccessToken");
