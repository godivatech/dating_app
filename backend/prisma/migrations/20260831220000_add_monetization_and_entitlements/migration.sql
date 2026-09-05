-- CreateEnum
CREATE TYPE "SubscriptionTier" AS ENUM ('FREE', 'PLUS', 'GOLD', 'A_LA_CARTE');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'CANCELED', 'EXPIRED', 'REVOKED', 'GRACE_PERIOD', 'PAUSED');

-- CreateEnum
CREATE TYPE "BillingPeriod" AS ENUM ('MONTHLY', 'QUARTERLY', 'ANNUAL', 'ONE_TIME');

-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('APPLE', 'GOOGLE', 'MOCK');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED', 'REVOKED');

-- CreateEnum
CREATE TYPE "EntitlementKey" AS ENUM ('UNLIMITED_LIKES', 'SEE_LIKES', 'REWIND_PASS', 'PROFILE_BOOST', 'ADVANCED_PREFERENCES', 'DISCOVERY_PRIORITY');

-- CreateEnum
CREATE TYPE "EntitlementSource" AS ENUM ('SUBSCRIPTION', 'ONE_TIME_PURCHASE', 'PROMOTION', 'ADMIN_GRANT', 'REFERRAL');

-- CreateTable
CREATE TABLE "SubscriptionProduct" (
    "id" TEXT NOT NULL,
    "productKey" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "tier" "SubscriptionTier" NOT NULL DEFAULT 'PLUS',
    "platform" "DevicePlatform" NOT NULL DEFAULT 'IOS',
    "storeProductId" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "priceAmount" INTEGER NOT NULL,
    "billingPeriod" "BillingPeriod" NOT NULL DEFAULT 'MONTHLY',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubscriptionProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL DEFAULT 'MOCK',
    "providerSubscriptionId" TEXT,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "canceledAt" TIMESTAMP(3),
    "autoRenewing" BOOLEAN NOT NULL DEFAULT true,
    "lastVerifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" "DevicePlatform" NOT NULL DEFAULT 'IOS',
    "provider" "PaymentProvider" NOT NULL DEFAULT 'MOCK',
    "providerTransactionId" TEXT NOT NULL,
    "originalTransactionId" TEXT,
    "productId" TEXT,
    "storeProductId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" "TransactionStatus" NOT NULL DEFAULT 'COMPLETED',
    "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rawPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserEntitlement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "entitlementKey" "EntitlementKey" NOT NULL,
    "source" "EntitlementSource" NOT NULL DEFAULT 'SUBSCRIPTION',
    "sourceReferenceId" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserEntitlement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionProduct_productKey_key" ON "SubscriptionProduct"("productKey");

-- CreateIndex
CREATE INDEX "SubscriptionProduct_tier_isActive_idx" ON "SubscriptionProduct"("tier", "isActive");

-- CreateIndex
CREATE INDEX "SubscriptionProduct_storeProductId_idx" ON "SubscriptionProduct"("storeProductId");

-- CreateIndex
CREATE INDEX "UserSubscription_userId_status_expiresAt_idx" ON "UserSubscription"("userId", "status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseTransaction_providerTransactionId_key" ON "PurchaseTransaction"("providerTransactionId");

-- CreateIndex
CREATE INDEX "PurchaseTransaction_userId_status_idx" ON "PurchaseTransaction"("userId", "status");

-- CreateIndex
CREATE INDEX "PurchaseTransaction_storeProductId_idx" ON "PurchaseTransaction"("storeProductId");

-- CreateIndex
CREATE UNIQUE INDEX "UserEntitlement_userId_entitlementKey_sourceReferenceId_key" ON "UserEntitlement"("userId", "entitlementKey", "sourceReferenceId");

-- CreateIndex
CREATE INDEX "UserEntitlement_userId_entitlementKey_isActive_expiresAt_idx" ON "UserEntitlement"("userId", "entitlementKey", "isActive", "expiresAt");

-- AddForeignKey
ALTER TABLE "UserSubscription" ADD CONSTRAINT "UserSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSubscription" ADD CONSTRAINT "UserSubscription_productId_fkey" FOREIGN KEY ("productId") REFERENCES "SubscriptionProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseTransaction" ADD CONSTRAINT "PurchaseTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseTransaction" ADD CONSTRAINT "PurchaseTransaction_productId_fkey" FOREIGN KEY ("productId") REFERENCES "SubscriptionProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserEntitlement" ADD CONSTRAINT "UserEntitlement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
