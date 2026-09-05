import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { StrikeSeverity, UserStatus } from '@prisma/client';

export interface StrikeResult {
  strikeNumber: number;
  actionTaken: 'WARNING' | 'MUTE_24H' | 'SHADOWBAN_7D' | 'SUSPENDED';
  userNotified: boolean;
  restrictionExpiry?: Date;
}

const STRIKE_WINDOW_DAYS = 30;

@Injectable()
export class DisciplineService {
  private readonly logger = new Logger(DisciplineService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Evaluates user violation history within the rolling 30-day window,
   * creates an immutable safety strike record, and enacts automatic progressive discipline.
   */
  async recordViolation(
    userId: string,
    reason: string,
    evidence?: string,
    severity: StrikeSeverity = StrikeSeverity.MEDIUM,
  ): Promise<StrikeResult> {
    const windowStart = new Date(
      Date.now() - STRIKE_WINDOW_DAYS * 24 * 60 * 60 * 1000,
    );

    // 1. Calculate active strikes in the last 30 days
    const activeStrikesCount = await this.prisma.userSafetyStrike.count({
      where: {
        userId,
        createdAt: { gte: windowStart },
      },
    });

    const strikeNumber = activeStrikesCount + 1;
    let actionTaken: 'WARNING' | 'MUTE_24H' | 'SHADOWBAN_7D' | 'SUSPENDED';
    let restrictionExpiry: Date | undefined;

    // 2. Determine progressive action
    if (strikeNumber === 1) {
      actionTaken = 'WARNING';
      this.logger.warn(
        `[SAFETY_STRIKE_1] User ${userId} issued Strike 1 (WARNING). Reason: ${reason}`,
      );
    } else if (strikeNumber === 2) {
      actionTaken = 'MUTE_24H';
      restrictionExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      await this.prisma.user.update({
        where: { id: userId },
        data: { messagingRestrictedUntil: restrictionExpiry },
      });
      this.logger.warn(
        `[SAFETY_STRIKE_2] User ${userId} issued Strike 2 (24H MUTE). Muted until ${restrictionExpiry.toISOString()}`,
      );
    } else if (strikeNumber === 3) {
      actionTaken = 'SHADOWBAN_7D';
      restrictionExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          messagingRestrictedUntil: restrictionExpiry,
          shadowBannedUntil: restrictionExpiry,
        },
      });
      this.logger.warn(
        `[SAFETY_STRIKE_3] User ${userId} issued Strike 3 (7D SHADOWBAN). Restricted until ${restrictionExpiry.toISOString()}`,
      );
    } else {
      actionTaken = 'SUSPENDED';
      await this.prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: userId },
          data: { status: UserStatus.BANNED },
        });

        // Revoke all active authentication sessions
        await tx.authSession.updateMany({
          where: { userId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      });
      this.logger.error(
        `[SAFETY_STRIKE_4] User ${userId} reached Strike ${strikeNumber}. Account permanently BANNED.`,
      );
    }

    // 3. Persist strike record
    await this.prisma.userSafetyStrike.create({
      data: {
        userId,
        reason,
        severity,
        strikeNumber,
        actionTaken,
        evidence: evidence ? evidence.substring(0, 500) : null,
      },
    });

    return {
      strikeNumber,
      actionTaken,
      userNotified: true,
      restrictionExpiry,
    };
  }

  /**
   * Retrieves active restrictions for a user.
   */
  async getActiveRestrictions(userId: string): Promise<{
    isMuted: boolean;
    isShadowBanned: boolean;
    messagingRestrictedUntil: Date | null;
    shadowBannedUntil: Date | null;
  }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        messagingRestrictedUntil: true,
        shadowBannedUntil: true,
      },
    });

    if (!user) {
      return {
        isMuted: false,
        isShadowBanned: false,
        messagingRestrictedUntil: null,
        shadowBannedUntil: null,
      };
    }

    const now = new Date();
    const isMuted = Boolean(
      user.messagingRestrictedUntil && user.messagingRestrictedUntil > now,
    );
    const isShadowBanned = Boolean(
      user.shadowBannedUntil && user.shadowBannedUntil > now,
    );

    return {
      isMuted,
      isShadowBanned,
      messagingRestrictedUntil: user.messagingRestrictedUntil,
      shadowBannedUntil: user.shadowBannedUntil,
    };
  }

  /**
   * Retrieves the comprehensive safety standing of a user.
   */
  async getUserSafetyStatus(userId: string): Promise<{
    standing: 'GOOD' | 'WARNING' | 'RESTRICTED' | 'BANNED';
    activeStrikes: number;
    isMuted: boolean;
    isShadowBanned: boolean;
    messagingRestrictedUntil: string | null;
    shadowBannedUntil: string | null;
  }> {
    const windowStart = new Date(
      Date.now() - STRIKE_WINDOW_DAYS * 24 * 60 * 60 * 1000,
    );

    const [activeStrikesCount, user] = await Promise.all([
      this.prisma.userSafetyStrike.count({
        where: {
          userId,
          createdAt: { gte: windowStart },
        },
      }),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          status: true,
          messagingRestrictedUntil: true,
          shadowBannedUntil: true,
        },
      }),
    ]);

    const now = new Date();
    const isMuted = Boolean(
      user?.messagingRestrictedUntil && user.messagingRestrictedUntil > now,
    );
    const isShadowBanned = Boolean(
      user?.shadowBannedUntil && user.shadowBannedUntil > now,
    );

    let standing: 'GOOD' | 'WARNING' | 'RESTRICTED' | 'BANNED' = 'GOOD';
    if (user?.status === UserStatus.BANNED) {
      standing = 'BANNED';
    } else if (isMuted || isShadowBanned) {
      standing = 'RESTRICTED';
    } else if (activeStrikesCount > 0) {
      standing = 'WARNING';
    }

    return {
      standing,
      activeStrikes: activeStrikesCount,
      isMuted,
      isShadowBanned,
      messagingRestrictedUntil: user?.messagingRestrictedUntil
        ? user.messagingRestrictedUntil.toISOString()
        : null,
      shadowBannedUntil: user?.shadowBannedUntil
        ? user.shadowBannedUntil.toISOString()
        : null,
    };
  }
}
