-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MAN', 'WOMAN', 'NON_BINARY', 'OTHER');

-- CreateEnum
CREATE TYPE "PreferredGenderMode" AS ENUM ('ANY', 'SELECTED');

-- CreateEnum
CREATE TYPE "RelationshipIntent" AS ENUM ('LONG_TERM', 'MARRIAGE', 'SERIOUS_DATING', 'OPEN_TO_EXPLORE', 'CASUAL');

-- CreateEnum
CREATE TYPE "ProfileVisibility" AS ENUM ('VISIBLE', 'HIDDEN');

-- CreateEnum
CREATE TYPE "ProfileStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'READY');

-- CreateEnum
CREATE TYPE "InterestStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateTable
CREATE TABLE "DatingProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3) NOT NULL,
    "gender" "Gender" NOT NULL,
    "bio" TEXT,
    "locationCity" TEXT,
    "locationRegion" TEXT,
    "locationCountry" TEXT NOT NULL DEFAULT 'IN',
    "visibility" "ProfileVisibility" NOT NULL DEFAULT 'HIDDEN',
    "status" "ProfileStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DatingProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DatingPreferences" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "preferredGenderMode" "PreferredGenderMode" NOT NULL DEFAULT 'SELECTED',
    "preferredGenders" "Gender"[],
    "minAge" INTEGER NOT NULL DEFAULT 18,
    "maxAge" INTEGER NOT NULL DEFAULT 35,
    "relationshipIntent" "RelationshipIntent" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DatingPreferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Interest" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "status" "InterestStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Interest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfileInterest" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "interestId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfileInterest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DatingProfile_userId_key" ON "DatingProfile"("userId");

-- CreateIndex
CREATE INDEX "DatingProfile_userId_idx" ON "DatingProfile"("userId");

-- CreateIndex
CREATE INDEX "DatingProfile_status_visibility_idx" ON "DatingProfile"("status", "visibility");

-- CreateIndex
CREATE UNIQUE INDEX "DatingPreferences_profileId_key" ON "DatingPreferences"("profileId");

-- CreateIndex
CREATE INDEX "DatingPreferences_profileId_idx" ON "DatingPreferences"("profileId");

-- CreateIndex
CREATE UNIQUE INDEX "ProfileInterest_profileId_interestId_key" ON "ProfileInterest"("profileId", "interestId");

-- CreateIndex
CREATE INDEX "ProfileInterest_profileId_idx" ON "ProfileInterest"("profileId");

-- CreateIndex
CREATE INDEX "ProfileInterest_interestId_idx" ON "ProfileInterest"("interestId");

-- AddForeignKey
ALTER TABLE "DatingProfile" ADD CONSTRAINT "DatingProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DatingPreferences" ADD CONSTRAINT "DatingPreferences_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "DatingProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileInterest" ADD CONSTRAINT "ProfileInterest_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "DatingProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileInterest" ADD CONSTRAINT "ProfileInterest_interestId_fkey" FOREIGN KEY ("interestId") REFERENCES "Interest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
