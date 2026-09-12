import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EntitlementKey, CoinTransactionType } from '@prisma/client';
import { UserCreditBalanceDto } from '../../../../shared/src/types';

@Injectable()
export class CreditService {
  private readonly logger = new Logger(CreditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Retrieves or initializes the persistent consumable credit balance for a user.
   */
  async getOrCreateBalance(userId: string) {
    let balance = await this.prisma.userCreditBalance.findUnique({
      where: { userId },
    });

    if (!balance) {
      balance = await this.prisma.userCreditBalance.create({
        data: {
          userId,
          coins: 0,
          directNotes: 0,
          profileBoosts: 0,
          callPassMinutes: 0,
        },
      });
    }

    return balance;
  }

  /**
   * Returns a clean public DTO of the user's credits including active boost expiry.
   */
  async getUserCreditDto(userId: string): Promise<UserCreditBalanceDto> {
    const balance = await this.getOrCreateBalance(userId);

    // Check active profile boost entitlement
    const now = new Date();
    const activeBoost = await this.prisma.userEntitlement.findFirst({
      where: {
        userId,
        entitlementKey: EntitlementKey.PROFILE_BOOST,
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      orderBy: { expiresAt: 'desc' },
    });

    return {
      coins: balance.coins,
      directNotes: balance.directNotes,
      profileBoosts: balance.profileBoosts,
      callPassMinutes: balance.callPassMinutes,
      boostExpiresAt: activeBoost?.expiresAt ? activeBoost.expiresAt.toISOString() : null,
    };
  }

  /**
   * Atomically adds consumable credits to a user's balance.
   */
  async addCredits(
    userId: string,
    field: 'directNotes' | 'profileBoosts' | 'callPassMinutes',
    amount: number,
    tx?: any,
  ) {
    const client = tx || this.prisma;
    await this.getOrCreateBalance(userId);

    const updated = await client.userCreditBalance.update({
      where: { userId },
      data: {
        [field]: { increment: amount },
      },
    });

    this.logger.log(
      `[CREDIT_ADD] User ${userId} granted ${amount} to ${field}. New balance: ${updated[field]}`,
    );

    return updated;
  }

  /**
   * Atomically decrements 1 Direct Note credit using row-level conditional update.
   * Returns true if successfully decremented, false if balance was zero.
   */
  async deductDirectNote(userId: string, tx?: any): Promise<boolean> {
    const client = tx || this.prisma;
    const result = await client.userCreditBalance.updateMany({
      where: {
        userId,
        directNotes: { gte: 1 },
      },
      data: {
        directNotes: { decrement: 1 },
      },
    });

    return result.count > 0;
  }

  /**
   * Atomically decrements 1 Profile Boost credit using row-level conditional update.
   * Returns true if successfully decremented, false if balance was zero.
   */
  async deductBoost(userId: string, tx?: any): Promise<boolean> {
    const client = tx || this.prisma;
    const result = await client.userCreditBalance.updateMany({
      where: {
        userId,
        profileBoosts: { gte: 1 },
      },
      data: {
        profileBoosts: { decrement: 1 },
      },
    });

    return result.count > 0;
  }

  /**
   * Atomically decrements call pass minutes.
   */
  async deductCallMinutes(userId: string, minutes: number, tx?: any): Promise<boolean> {
    const client = tx || this.prisma;
    const result = await client.userCreditBalance.updateMany({
      where: {
        userId,
        callPassMinutes: { gte: minutes },
      },
      data: {
        callPassMinutes: { decrement: minutes },
      },
    });

    return result.count > 0;
  }

  /**
   * Atomically credits coins to user's wallet balance and records an immutable ledger entry.
   */
  async addCoins(
    userId: string,
    amount: number,
    type: CoinTransactionType = CoinTransactionType.PURCHASE_RECHARGE,
    description?: string,
    referenceId?: string,
    tx?: any,
  ) {
    const client = tx || this.prisma;
    await this.getOrCreateBalance(userId);

    const updated = await client.userCreditBalance.update({
      where: { userId },
      data: {
        coins: { increment: amount },
      },
    });

    await client.coinTransaction.create({
      data: {
        userId,
        amount,
        balanceAfter: updated.coins,
        type,
        description: description || `Recharge of ${amount} coins`,
        referenceId,
      },
    });

    this.logger.log(
      `[COIN_ADD] User ${userId} granted ${amount} coins. New balance: ${updated.coins}`,
    );

    return updated;
  }

  /**
   * Atomically decrements coins using row-level conditional checks (prevents double-spending/negative balance).
   * Records ledger entry in the same transaction.
   */
  async deductCoins(
    userId: string,
    amount: number,
    type: CoinTransactionType,
    description?: string,
    referenceId?: string,
    tx?: any,
  ): Promise<boolean> {
    const client = tx || this.prisma;
    await this.getOrCreateBalance(userId);

    const result = await client.userCreditBalance.updateMany({
      where: {
        userId,
        coins: { gte: amount },
      },
      data: {
        coins: { decrement: amount },
      },
    });

    if (result.count === 0) {
      return false; // Insufficient coins
    }

    const balance = await client.userCreditBalance.findUnique({
      where: { userId },
      select: { coins: true },
    });

    await client.coinTransaction.create({
      data: {
        userId,
        amount: -amount,
        balanceAfter: balance?.coins ?? 0,
        type,
        description: description || `Spent ${amount} coins`,
        referenceId,
      },
    });

    this.logger.log(
      `[COIN_DEDUCT] User ${userId} spent ${amount} coins (${type}). New balance: ${balance?.coins}`,
    );

    return true;
  }

  /**
   * Retrieves user's coin transaction ledger history.
   */
  async getCoinHistory(userId: string, limit = 20) {
    return this.prisma.coinTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
