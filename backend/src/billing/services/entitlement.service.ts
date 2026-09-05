import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  EntitlementKey,
  EntitlementSource,
  UserEntitlement,
  Prisma,
} from '@prisma/client';
import { SafeUserEntitlement } from '../../../../shared/src/types';

@Injectable()
export class EntitlementService {
  private readonly logger = new Logger(EntitlementService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Authoritative server check: Does the user have this active entitlement?
   */
  async hasEntitlement(
    userId: string,
    key: EntitlementKey,
  ): Promise<boolean> {
    if (!this.prisma?.userEntitlement) return false;

    const now = new Date();

    const entitlement = await this.prisma.userEntitlement.findFirst({
      where: {
        userId,
        entitlementKey: key,
        isActive: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: now } },
        ],
      },
    });

    return !!entitlement;
  }

  /**
   * Retrieves all active capabilities for a user.
   */
  async getUserEntitlements(userId: string): Promise<SafeUserEntitlement[]> {
    if (!this.prisma?.userEntitlement) return [];

    const now = new Date();

    const entitlements = await this.prisma.userEntitlement.findMany({
      where: {
        userId,
        isActive: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: now } },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });

    return entitlements.map((e) => this.mapToSafeEntitlement(e));
  }

  /**
   * Grants an entitlement idempotently to a user.
   */
  async grantEntitlement(
    userId: string,
    key: EntitlementKey,
    source: EntitlementSource,
    sourceReferenceId?: string,
    expiresAt?: Date | null,
    prismaClient?: Prisma.TransactionClient,
  ): Promise<UserEntitlement> {
    const db = prismaClient || this.prisma;

    this.logger.log(
      `[ENTITLEMENT_GRANTED] User ${userId} granted ${key} from ${source}`,
    );

    return db.userEntitlement.upsert({
      where: {
        userId_entitlementKey_sourceReferenceId: {
          userId,
          entitlementKey: key,
          sourceReferenceId: sourceReferenceId || '',
        },
      },
      update: {
        isActive: true,
        expiresAt: expiresAt || null,
        updatedAt: new Date(),
      },
      create: {
        userId,
        entitlementKey: key,
        source,
        sourceReferenceId: sourceReferenceId || '',
        expiresAt: expiresAt || null,
        isActive: true,
      },
    });
  }

  /**
   * Revokes entitlements associated with a specific source (e.g. on refund or expiration).
   */
  async revokeEntitlementsForSource(
    source: EntitlementSource,
    sourceReferenceId: string,
    prismaClient?: Prisma.TransactionClient,
  ): Promise<number> {
    const db = prismaClient || this.prisma;

    const result = await db.userEntitlement.updateMany({
      where: {
        source,
        sourceReferenceId,
      },
      data: {
        isActive: false,
      },
    });

    this.logger.log(
      `[ENTITLEMENTS_REVOKED] Revoked ${result.count} entitlements for ${source}:${sourceReferenceId}`,
    );

    return result.count;
  }

  private mapToSafeEntitlement(entitlement: UserEntitlement): SafeUserEntitlement {
    const startsAtDate = entitlement.startsAt ? new Date(entitlement.startsAt) : new Date();
    return {
      id: entitlement.id,
      userId: entitlement.userId,
      entitlementKey: entitlement.entitlementKey as any,
      source: entitlement.source as any,
      sourceReferenceId: entitlement.sourceReferenceId,
      startsAt: startsAtDate.toISOString(),
      expiresAt: entitlement.expiresAt ? new Date(entitlement.expiresAt).toISOString() : null,
      isActive: entitlement.isActive,
    };
  }
}
