import {
  Injectable,
  Inject,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SubscriptionService } from './subscription.service';
import { EntitlementService } from './entitlement.service';
import { PURCHASE_PROVIDER } from '../providers/purchase-provider.interface';
import type { PurchaseProvider } from '../providers/purchase-provider.interface';
import { VerifyPurchaseDto } from '../dto/verify-purchase.dto';
import { RestorePurchasesDto } from '../dto/restore-purchases.dto';
import { CreditService } from './credit.service';
import {
  SubscriptionTier,
  SubscriptionStatus,
  TransactionStatus,
  EntitlementKey,
  EntitlementSource,
  CoinTransactionType,
} from '@prisma/client';
import {
  VerifyPurchaseResponse,
  RestorePurchasesResponse,
} from '../../../../shared/src/types';

@Injectable()
export class PurchaseService {
  private readonly logger = new Logger(PurchaseService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptionService: SubscriptionService,
    private readonly entitlementService: EntitlementService,
    private readonly creditService: CreditService,
    @Inject(PURCHASE_PROVIDER)
    private readonly purchaseProvider: PurchaseProvider,
  ) {}

  /**
   * Idempotent purchase verification with replay attack protection.
   */
  async verifyPurchase(
    userId: string,
    dto: VerifyPurchaseDto,
  ): Promise<VerifyPurchaseResponse> {
    this.logger.log(
      `[PURCHASE_VERIFY_REQUEST] User ${userId} submitting purchase for ${dto.storeProductId}`,
    );

    // 1. Validate with Purchase Provider
    const verification = await this.purchaseProvider.verifyReceipt(
      dto.platform,
      dto.storeProductId,
      dto.receiptToken,
      dto.transactionId,
    );

    if (!verification.isValid) {
      throw new BadRequestException(
        verification.errorMessage || 'Invalid purchase receipt provided.',
      );
    }

    // 2. Replay Protection: Check if transaction ID was already processed
    const existingTx = await this.prisma.purchaseTransaction.findUnique({
      where: { providerTransactionId: verification.providerTransactionId },
      include: { product: true },
    });

    if (existingTx && existingTx.status === TransactionStatus.COMPLETED) {
      this.logger.log(
        `[PURCHASE_REPLAY_DETECTED] Transaction ${verification.providerTransactionId} already processed for user ${existingTx.userId}`,
      );

      const activeSub = await this.subscriptionService.getActiveSubscription(userId);
      const entitlements = await this.entitlementService.getUserEntitlements(userId);

      return {
        success: true,
        transactionId: existingTx.id,
        status: existingTx.status as any,
        subscription: activeSub,
        grantedEntitlements: entitlements.map((e) => e.entitlementKey as any),
        message: 'Purchase already processed and active.',
      };
    }

    // 3. Find matching subscription product
    const product = await this.prisma.subscriptionProduct.findFirst({
      where: {
        OR: [
          { storeProductId: dto.storeProductId },
          { productKey: dto.storeProductId },
        ],
      },
    });

    if (!product) {
      throw new NotFoundException(
        `Product with store ID ${dto.storeProductId} not found in catalog.`,
      );
    }

    // 4. Determine capabilities to grant
    const grantedEntitlements: EntitlementKey[] = [];
    if (product.tier === SubscriptionTier.PLUS) {
      grantedEntitlements.push(
        EntitlementKey.UNLIMITED_LIKES,
        EntitlementKey.REWIND_PASS,
      );
    } else if (product.tier === SubscriptionTier.GOLD) {
      grantedEntitlements.push(
        EntitlementKey.SEE_LIKES,
        EntitlementKey.UNLIMITED_LIKES,
        EntitlementKey.REWIND_PASS,
        EntitlementKey.PROFILE_BOOST,
        EntitlementKey.UNLIMITED_DIRECT_NOTES,
        EntitlementKey.VIDEO_CALL,
        EntitlementKey.AUDIO_CALL,
      );
    }

    const expiresAt =
      verification.expiresAt ||
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    // 5. Execute Atomic Database Transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Record Purchase Transaction
      const transaction = await tx.purchaseTransaction.create({
        data: {
          userId,
          platform: dto.platform,
          provider: verification.provider,
          providerTransactionId: verification.providerTransactionId,
          originalTransactionId: verification.originalTransactionId,
          productId: product.id,
          storeProductId: product.storeProductId,
          amount: verification.amount || product.priceAmount,
          currency: verification.currency || product.currency,
          status: verification.status,
          verifiedAt: new Date(),
          rawPayload: verification.rawPayload as any,
        },
      });

      let createdSub: any = null;

      // If subscription, create or update UserSubscription
      if (product.tier !== SubscriptionTier.A_LA_CARTE) {
        createdSub = await tx.userSubscription.create({
          data: {
            userId,
            productId: product.id,
            provider: verification.provider,
            providerSubscriptionId: verification.providerTransactionId,
            status: SubscriptionStatus.ACTIVE,
            startedAt: new Date(),
            expiresAt,
            autoRenewing: verification.autoRenewing ?? true,
            lastVerifiedAt: new Date(),
          },
          include: { product: true },
        });

        // Grant Subscription Entitlements
        for (const key of grantedEntitlements) {
          await this.entitlementService.grantEntitlement(
            userId,
            key,
            EntitlementSource.SUBSCRIPTION,
            transaction.id,
            expiresAt,
            tx,
          );
        }
      } else {
        // A-La-Carte Consumable Fulfillment
        const prodKey = product.productKey;
        const meta = (product.metadata as any) || {};

        if (prodKey.startsWith('COIN_PACK_')) {
          const coinsCount = meta.coinsCount || (prodKey.includes('700') ? 700 : prodKey.includes('250') ? 250 : 100);
          await this.creditService.addCoins(
            userId,
            coinsCount,
            CoinTransactionType.PURCHASE_RECHARGE,
            `Recharge: ${product.displayName}`,
            transaction.id,
            tx,
          );
        } else if (prodKey.startsWith('DIRECT_NOTES_')) {
          const notesCount = meta.notesCount || (prodKey.includes('30') ? 30 : prodKey.includes('15') ? 15 : 5);
          await this.creditService.addCredits(userId, 'directNotes', notesCount, tx);
        } else if (prodKey.startsWith('BOOST_PACK_')) {
          const boostsCount = meta.boostsCount || (prodKey.includes('3') ? 3 : 1);
          await this.creditService.addCredits(userId, 'profileBoosts', boostsCount, tx);
        } else if (prodKey.startsWith('CALL_PASS_')) {
          const callMinutes = meta.callMinutes || (prodKey.includes('sponsor') ? 15 : 30);
          await this.creditService.addCredits(userId, 'callPassMinutes', callMinutes, tx);
        }
      }

      return { transaction, subscription: createdSub };
    });

    this.logger.log(
      `[PURCHASE_COMPLETED] User ${userId} successfully unlocked ${product.displayName}`,
    );

    const safeSubscription = result.subscription
      ? this.subscriptionService.mapToSafeSubscription(result.subscription)
      : null;

    return {
      success: true,
      transactionId: result.transaction.id,
      status: result.transaction.status as any,
      subscription: safeSubscription,
      grantedEntitlements: grantedEntitlements as any,
      message: `Successfully activated ${product.displayName}!`,
    };
  }

  /**
   * Restores previously purchased subscriptions for the user across store receipts.
   */
  async restorePurchases(
    userId: string,
    dto: RestorePurchasesDto,
  ): Promise<RestorePurchasesResponse> {
    this.logger.log(
      `[PURCHASE_RESTORE_REQUEST] User ${userId} restoring ${dto.receiptTokens.length} receipts on ${dto.platform}`,
    );

    const restored = await this.purchaseProvider.restorePurchases(
      dto.platform,
      dto.receiptTokens,
    );

    let anyRestored = false;
    for (const item of restored) {
      if (item.isValid) {
        try {
          await this.verifyPurchase(userId, {
            platform: dto.platform,
            storeProductId: item.storeProductId,
            receiptToken: item.rawPayload?.receiptToken || 'restored_token',
            transactionId: item.providerTransactionId,
          });
          anyRestored = true;
        } catch (err: any) {
          this.logger.warn(`Failed restoring single receipt: ${err.message}`);
        }
      }
    }

    const activeSub = await this.subscriptionService.getActiveSubscription(userId);
    const entitlements = await this.entitlementService.getUserEntitlements(userId);

    return {
      restored: anyRestored,
      activeSubscription: activeSub,
      entitlements,
      message: anyRestored
        ? 'Purchases restored successfully.'
        : 'No active purchases found to restore.',
    };
  }
}
