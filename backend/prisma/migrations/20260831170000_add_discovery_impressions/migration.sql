-- CreateTable
CREATE TABLE "DiscoveryImpression" (
    "id" TEXT NOT NULL,
    "requestingUserId" TEXT NOT NULL,
    "candidateProfileId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "algorithmVersion" TEXT NOT NULL DEFAULT 'baseline-v1',
    "servedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiscoveryImpression_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DiscoveryImpression_requestingUserId_servedAt_idx" ON "DiscoveryImpression"("requestingUserId", "servedAt");

-- CreateIndex
CREATE INDEX "DiscoveryImpression_requestingUserId_candidateProfileId_idx" ON "DiscoveryImpression"("requestingUserId", "candidateProfileId");

-- CreateIndex
CREATE INDEX "DiscoveryImpression_candidateProfileId_servedAt_idx" ON "DiscoveryImpression"("candidateProfileId", "servedAt");

-- CreateIndex
CREATE INDEX "DatingProfile_gender_dateOfBirth_idx" ON "DatingProfile"("gender", "dateOfBirth");

-- CreateIndex
CREATE INDEX "DatingPreferences_minAge_maxAge_idx" ON "DatingPreferences"("minAge", "maxAge");

-- AddForeignKey
ALTER TABLE "DiscoveryImpression" ADD CONSTRAINT "DiscoveryImpression_requestingUserId_fkey" FOREIGN KEY ("requestingUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscoveryImpression" ADD CONSTRAINT "DiscoveryImpression_candidateProfileId_fkey" FOREIGN KEY ("candidateProfileId") REFERENCES "DatingProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
