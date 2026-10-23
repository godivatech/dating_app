-- AlterTable
ALTER TABLE "VirtualGiftTransaction" ADD COLUMN "idempotencyKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "VirtualGiftTransaction_idempotencyKey_key" ON "VirtualGiftTransaction"("idempotencyKey");
