-- CreateEnum
CREATE TYPE "ActionType" AS ENUM ('LIKE', 'PASS');

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('ACTIVE', 'UNMATCHED');

-- CreateTable
CREATE TABLE "UserAction" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "targetProfileId" TEXT NOT NULL,
    "actionType" "ActionType" NOT NULL,
    "algorithmVersion" TEXT DEFAULT 'baseline-v1',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Match" (
    "id" TEXT NOT NULL,
    "user1Id" TEXT NOT NULL,
    "user2Id" TEXT NOT NULL,
    "status" "MatchStatus" NOT NULL DEFAULT 'ACTIVE',
    "unmatchedByUserId" TEXT,
    "unmatchedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserAction_actorUserId_targetProfileId_key" ON "UserAction"("actorUserId", "targetProfileId");

-- CreateIndex
CREATE INDEX "UserAction_actorUserId_actionType_idx" ON "UserAction"("actorUserId", "actionType");

-- CreateIndex
CREATE INDEX "UserAction_targetProfileId_actionType_idx" ON "UserAction"("targetProfileId", "actionType");

-- CreateIndex
CREATE UNIQUE INDEX "Match_user1Id_user2Id_key" ON "Match"("user1Id", "user2Id");

-- CreateIndex
CREATE INDEX "Match_user1Id_status_idx" ON "Match"("user1Id", "status");

-- CreateIndex
CREATE INDEX "Match_user2Id_status_idx" ON "Match"("user2Id", "status");

-- CreateIndex
CREATE INDEX "Match_status_updatedAt_idx" ON "Match"("status", "updatedAt");

-- AddForeignKey
ALTER TABLE "UserAction" ADD CONSTRAINT "UserAction_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAction" ADD CONSTRAINT "UserAction_targetProfileId_fkey" FOREIGN KEY ("targetProfileId") REFERENCES "DatingProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_user1Id_fkey" FOREIGN KEY ("user1Id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_user2Id_fkey" FOREIGN KEY ("user2Id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
