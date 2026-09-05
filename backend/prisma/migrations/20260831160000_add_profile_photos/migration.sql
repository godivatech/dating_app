-- CreateEnum
CREATE TYPE "PhotoStatus" AS ENUM ('UPLOADING', 'UPLOADED', 'PROCESSING', 'PENDING_MODERATION', 'APPROVED', 'REJECTED', 'DELETED');

-- CreateTable
CREATE TABLE "ProfilePhoto" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "thumbnailKey" TEXT,
    "mediumKey" TEXT,
    "largeKey" TEXT,
    "status" "PhotoStatus" NOT NULL DEFAULT 'UPLOADING',
    "position" INTEGER NOT NULL DEFAULT 0,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfilePhoto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProfilePhoto_profileId_status_idx" ON "ProfilePhoto"("profileId", "status");

-- CreateIndex
CREATE INDEX "ProfilePhoto_profileId_position_idx" ON "ProfilePhoto"("profileId", "position");

-- AddForeignKey
ALTER TABLE "ProfilePhoto" ADD CONSTRAINT "ProfilePhoto_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "DatingProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
