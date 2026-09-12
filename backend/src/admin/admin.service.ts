import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DiscoveryPaginationService } from '../discovery/services/discovery-pagination.service';
import type { StorageService } from '../media/storage/storage.interface';
import { STORAGE_SERVICE } from '../media/storage/storage.interface';
import { NotificationsService } from '../notifications/services/notifications.service';
import { calculateAge } from '../profile/utils/age.util';
import {
  UserStatus,
  UserRole,
  PhotoStatus,
  ProfileStatus,
  ProfileVisibility,
  ReportStatus,
  StrikeSeverity,
  SubscriptionTier,
  SubscriptionStatus,
  ModerationActionType,
  MatchStatus,
  CoinTransactionType,
} from '@prisma/client';
import {
  AdminAnalyticsOverviewDto,
  AdminRevenueOverviewDto,
  AdminUsersQueryDto,
  AdminUsersListResponse,
  AdminUserListItemDto,
  AdminUserDetailDto,
  AdminDisciplineDto,
  AdminPhotoQueueItemDto,
  AdminReviewPhotoDto,
  SafeProfilePhoto,
  NotificationType,
} from '../../../shared/src/types';

const STRIKE_WINDOW_DAYS = 30;

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly paginationService: DiscoveryPaginationService,
    @Inject(STORAGE_SERVICE)
    private readonly storageService: StorageService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Aggregates real-time business and system KPIs for the admin dashboard.
   */
  async getAnalyticsOverview(): Promise<AdminAnalyticsOverviewDto> {
    const now = new Date();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [
      totalUsers,
      activeToday,
      verifiedUsers,
      totalMatches,
      sparkPlusSubs,
      sparkGoldSubs,
      activeSubsWithProducts,
      directNotePacksCount,
      pendingReportsCount,
      pendingPhotosCount,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({
        where: { lastLoginAt: { gte: todayStart } },
      }),
      this.prisma.user.count({
        where: { phoneVerifiedAt: { not: null } },
      }),
      this.prisma.match.count({
        where: { status: MatchStatus.ACTIVE },
      }),
      this.prisma.userSubscription.count({
        where: {
          product: { tier: SubscriptionTier.PLUS },
          status: SubscriptionStatus.ACTIVE,
          expiresAt: { gt: now },
        },
      }),
      this.prisma.userSubscription.count({
        where: {
          product: { tier: SubscriptionTier.GOLD },
          status: SubscriptionStatus.ACTIVE,
          expiresAt: { gt: now },
        },
      }),
      this.prisma.userSubscription.findMany({
        where: {
          status: SubscriptionStatus.ACTIVE,
          expiresAt: { gt: now },
        },
        include: { product: true },
      }),
      this.prisma.purchaseTransaction.count({
        where: {
          status: 'COMPLETED',
          OR: [
            { storeProductId: { contains: 'coin', mode: 'insensitive' } },
            { storeProductId: { contains: 'notes', mode: 'insensitive' } },
            { storeProductId: { contains: 'boost', mode: 'insensitive' } },
            { storeProductId: { contains: 'call', mode: 'insensitive' } },
          ],
        },
      }),
      this.prisma.report.count({
        where: { status: ReportStatus.OPEN },
      }),
      this.prisma.profilePhoto.count({
        where: { status: PhotoStatus.PENDING_MODERATION },
      }),
    ]);

    // Accurate live monthly recurring run-rate (MRR) + realized prepaid micro-recharges
    let estimatedMonthlyRevenueInr = 0;
    for (const sub of activeSubsWithProducts) {
      const priceInr = (sub.product?.priceAmount ?? 29900) / 100;
      estimatedMonthlyRevenueInr += priceInr;
    }

    try {
      const completedRecharges = await this.prisma.purchaseTransaction.aggregate({
        where: {
          status: 'COMPLETED',
          OR: [
            { storeProductId: { contains: 'coin', mode: 'insensitive' } },
            { storeProductId: { contains: 'COIN_PACK', mode: 'insensitive' } },
          ],
        },
        _sum: { amount: true },
      });
      estimatedMonthlyRevenueInr += (completedRecharges._sum.amount ?? 0) / 100;
    } catch {
      // Graceful fallback
    }

    return {
      totalUsers,
      activeToday,
      verifiedUsers,
      totalMatches,
      activeSubscriptions: {
        sparkPlus: sparkPlusSubs,
        sparkGold: sparkGoldSubs,
        total: sparkPlusSubs + sparkGoldSubs,
      },
      directNotePacksCount,
      pendingReportsCount,
      pendingPhotosCount,
      estimatedMonthlyRevenueInr: Number(estimatedMonthlyRevenueInr.toFixed(2)),
    };
  }

  /**
   * Search and filter users by phone number, name, status, or role with pagination.
   */
  async searchUsers(query: any): Promise<AdminUsersListResponse> {
    const limit = query.limit || 20;
    const offset = query.cursor
      ? this.paginationService.decodeCursor(query.cursor).offset
      : query.page && query.page > 1
        ? (query.page - 1) * limit
        : 0;

    const where: any = {};

    if (query.status) {
      where.status = query.status;
    }

    if (query.role) {
      where.role = query.role;
    }

    if (query.search) {
      const search = query.search.trim();
      where.OR = [
        { phoneNumber: { contains: search, mode: 'insensitive' } },
        {
          profile: {
            displayName: { contains: search, mode: 'insensitive' },
          },
        },
        { id: search },
      ];
    }

    const [totalCount, users] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        include: {
          profile: {
            include: {
              photos: {
                where: { status: PhotoStatus.APPROVED },
                orderBy: { position: 'asc' },
              },
            },
          },
          safetyStrikes: {
            where: {
              createdAt: {
                gte: new Date(Date.now() - STRIKE_WINDOW_DAYS * 86400000),
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit + 1,
      }),
    ]);

    const hasMore = users.length > limit;
    const items = hasMore ? users.slice(0, limit) : users;
    const nextCursor = hasMore
      ? this.paginationService.encodeCursor(offset + limit)
      : null;

    const now = new Date();
    const mappedUsers: AdminUserListItemDto[] = items.map((u) => {
      const primaryPhoto = u.profile?.photos?.[0];
      const photoKey =
        primaryPhoto?.thumbnailKey ||
        primaryPhoto?.mediumKey ||
        primaryPhoto?.largeKey ||
        primaryPhoto?.objectKey;
      const photoUrl = photoKey
        ? this.storageService.getPublicUrl(photoKey)
        : null;

      const isMuted = Boolean(
        u.messagingRestrictedUntil && u.messagingRestrictedUntil > now,
      );
      const isShadowBanned = Boolean(
        u.shadowBannedUntil && u.shadowBannedUntil > now,
      );

      return {
        id: u.id,
        phoneNumber: u.phoneNumber,
        displayName: u.profile?.displayName || null,
        age: u.profile?.dateOfBirth ? calculateAge(u.profile.dateOfBirth) : null,
        gender: (u.profile?.gender as any) || null,
        status: u.status as any,
        role: u.role as any,
        primaryPhotoUrl: photoUrl,
        activeStrikes: u.safetyStrikes?.length || 0,
        isMuted,
        isShadowBanned,
        createdAt: u.createdAt.toISOString(),
        lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
      };
    });

    return {
      users: mappedUsers,
      totalCount,
      nextCursor,
      hasMore,
    };
  }

  /**
   * Retrieves full 360-degree user dossier for administrative and safety investigation.
   */
  async getUserDetail(userId: string): Promise<AdminUserDetailDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: {
          include: {
            photos: { orderBy: { position: 'asc' } },
            interests: { include: { interest: true } },
            preferences: true,
          },
        },
        safetyStrikes: {
          orderBy: { createdAt: 'desc' },
        },
        subscriptions: {
          where: { status: SubscriptionStatus.ACTIVE },
          include: { product: true },
          take: 1,
        },
        creditBalance: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`User ${userId} not found.`);
    }

    const [mutualMatchesCount, directNotesSentCount] = await Promise.all([
      this.prisma.match.count({
        where: {
          OR: [{ user1Id: userId }, { user2Id: userId }],
        },
      }),
      this.prisma.userAction.count({
        where: { actorUserId: userId, note: { not: null } },
      }),
    ]);

    const profile = user.profile
      ? {
          id: user.profile.id,
          displayName: user.profile.displayName,
          age: calculateAge(user.profile.dateOfBirth),
          gender: user.profile.gender as any,
          bio: user.profile.bio,
          locationCity: user.profile.locationCity,
          locationRegion: user.profile.locationRegion,
          locationCountry: user.profile.locationCountry,
          status: user.profile.status as any,
          visibility: user.profile.visibility as any,
          photos: (user.profile.photos || []).map((p: any) => ({
            id: p.id,
            profileId: p.profileId,
            status: p.status,
            position: p.position,
            isPrimary: p.position === 0 && p.status === PhotoStatus.APPROVED,
            thumbnailUrl: (p.thumbnailKey || p.mediumKey || p.objectKey)
              ? this.storageService.getPublicUrl(p.thumbnailKey || p.mediumKey || p.objectKey)
              : null,
            mediumUrl: (p.mediumKey || p.largeKey || p.objectKey)
              ? this.storageService.getPublicUrl(p.mediumKey || p.largeKey || p.objectKey)
              : null,
            largeUrl: (p.largeKey || p.objectKey)
              ? this.storageService.getPublicUrl(p.largeKey || p.objectKey)
              : null,
            width: p.width,
            height: p.height,
            createdAt: p.createdAt ? p.createdAt.toISOString() : new Date().toISOString(),
            updatedAt: p.updatedAt ? p.updatedAt.toISOString() : new Date().toISOString(),
          })),
          interests: (user.profile.interests || []).map((pi: any) => ({
            id: pi.interest?.id || pi.interestId,
            name: pi.interest?.name || 'Interest',
            category: pi.interest?.category || 'General',
          })),
          preferences: user.profile.preferences,
        }
      : null;

    const strikes = user.safetyStrikes.map((s) => ({
      id: s.id,
      userId: s.userId,
      reason: s.reason,
      severity: s.severity as any,
      strikeNumber: s.strikeNumber,
      actionTaken: s.actionTaken,
      evidence: s.evidence,
      createdAt: s.createdAt.toISOString(),
    }));

    const activeSub = user.subscriptions?.[0];

    return {
      id: user.id,
      phoneNumber: user.phoneNumber,
      status: user.status as any,
      role: user.role as any,
      createdAt: user.createdAt.toISOString(),
      lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
      messagingRestrictedUntil: user.messagingRestrictedUntil
        ? user.messagingRestrictedUntil.toISOString()
        : null,
      shadowBannedUntil: user.shadowBannedUntil
        ? user.shadowBannedUntil.toISOString()
        : null,
      profile,
      strikes,
      subscription: activeSub
        ? {
            planType: activeSub.product?.tier as any,
            expiresAt: activeSub.expiresAt ? activeSub.expiresAt.toISOString() : null,
            status: activeSub.status as any,
          }
        : null,
      creditBalance: user.creditBalance
        ? {
            coins: user.creditBalance.coins ?? 0,
            directNotes: user.creditBalance.directNotes,
            profileBoosts: user.creditBalance.profileBoosts,
            callPassMinutes: user.creditBalance.callPassMinutes,
            boostExpiresAt: null,
          }
        : {
            coins: 0,
            directNotes: 0,
            profileBoosts: 0,
            callPassMinutes: 0,
            boostExpiresAt: null,
          },
      mutualMatchesCount,
      directNotesSentCount,
    };
  }

  /**
   * Applies manual administrative discipline to an account and logs an audit trail.
   */
  async updateUserDiscipline(
    userId: string,
    dto: AdminDisciplineDto,
    adminId: string,
  ): Promise<{ success: boolean; message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User ${userId} not found.`);
    }

    const now = new Date();

    switch (dto.action) {
      case 'WARN': {
        await this.prisma.userSafetyStrike.create({
          data: {
            userId,
            reason: dto.reason,
            severity: StrikeSeverity.LOW,
            strikeNumber: 1,
            actionTaken: 'ADMIN_WARNING',
          },
        });
        await this.notificationsService.createNotification(userId, {
          type: NotificationType.SAFETY_UPDATE,
          title: 'Official Community Guidelines Warning',
          body: dto.reason,
          metadata: { strikeNumber: 1, action: 'WARN' },
        });
        break;
      }
      case 'MUTE_24H': {
        const muteUntil = new Date(Date.now() + 86400000);
        await this.prisma.user.update({
          where: { id: userId },
          data: { messagingRestrictedUntil: muteUntil },
        });
        await this.prisma.userSafetyStrike.create({
          data: {
            userId,
            reason: dto.reason,
            severity: StrikeSeverity.MEDIUM,
            strikeNumber: 2,
            actionTaken: 'ADMIN_MUTE_24H',
          },
        });
        await this.notificationsService.createNotification(userId, {
          type: NotificationType.SAFETY_UPDATE,
          title: 'Account Restricted (24-Hour Chat Mute)',
          body: `Your messaging privileges have been paused for 24 hours. Reason: ${dto.reason}`,
          metadata: { strikeNumber: 2, action: 'MUTE_24H', muteUntil: muteUntil.toISOString() },
        });
        break;
      }
      case 'SHADOWBAN_7D': {
        const shadowbanUntil = new Date(Date.now() + 7 * 86400000);
        await this.prisma.user.update({
          where: { id: userId },
          data: {
            messagingRestrictedUntil: shadowbanUntil,
            shadowBannedUntil: shadowbanUntil,
          },
        });
        await this.prisma.userSafetyStrike.create({
          data: {
            userId,
            reason: dto.reason,
            severity: StrikeSeverity.HIGH,
            strikeNumber: 3,
            actionTaken: 'ADMIN_SHADOWBAN_7D',
          },
        });
        break;
      }
      case 'BAN': {
        await this.prisma.$transaction(async (tx) => {
          await tx.user.update({
            where: { id: userId },
            data: { status: UserStatus.BANNED },
          });
          await tx.authSession.updateMany({
            where: { userId, revokedAt: null },
            data: { revokedAt: now },
          });
        });
        await this.prisma.userSafetyStrike.create({
          data: {
            userId,
            reason: dto.reason,
            severity: StrikeSeverity.CRITICAL,
            strikeNumber: 4,
            actionTaken: 'ADMIN_PERMANENT_BAN',
          },
        });
        await this.notificationsService.createNotification(userId, {
          type: NotificationType.SAFETY_UPDATE,
          title: 'Account Suspended',
          body: `Your account has been permanently suspended for safety policy violations. Reason: ${dto.reason}`,
          metadata: { action: 'BAN' },
        });
        break;
      }
      case 'UNBAN': {
        await this.prisma.user.update({
          where: { id: userId },
          data: {
            status: UserStatus.ACTIVE,
            messagingRestrictedUntil: null,
            shadowBannedUntil: null,
          },
        });
        await this.notificationsService.createNotification(userId, {
          type: NotificationType.SAFETY_UPDATE,
          title: 'Account Restored',
          body: 'Your account has been reinstated to active standing following administrative review.',
          metadata: { action: 'UNBAN' },
        });
        break;
      }
      case 'RESET_STRIKES': {
        await this.prisma.userSafetyStrike.deleteMany({
          where: { userId },
        });
        await this.prisma.user.update({
          where: { id: userId },
          data: {
            messagingRestrictedUntil: null,
            shadowBannedUntil: null,
          },
        });
        await this.notificationsService.createNotification(userId, {
          type: NotificationType.SAFETY_UPDATE,
          title: 'Safety Strikes Cleared',
          body: 'Your accumulated safety strikes have been reset to zero by administration.',
          metadata: { action: 'RESET_STRIKES' },
        });
        break;
      }
      default:
        throw new BadRequestException(`Unsupported action: ${dto.action}`);
    }

    // Determine valid ModerationActionType from schema
    let auditAction: ModerationActionType;
    switch (dto.action) {
      case 'WARN':
        auditAction = ModerationActionType.WARN_USER;
        break;
      case 'MUTE_24H':
        auditAction = ModerationActionType.SUSPEND_ACCOUNT;
        break;
      case 'SHADOWBAN_7D':
        auditAction = ModerationActionType.HIDE_PROFILE;
        break;
      case 'BAN':
        auditAction = ModerationActionType.BAN_ACCOUNT;
        break;
      case 'UNBAN':
      case 'RESET_STRIKES':
        auditAction = ModerationActionType.RESTORE_ACCOUNT;
        break;
      default:
        auditAction = ModerationActionType.WARN_USER;
    }

    // Log administrative audit entry
    await this.prisma.moderationAuditLog.create({
      data: {
        moderatorUserId: adminId,
        targetUserId: userId,
        actionType: auditAction,
        reason: dto.reason,
        metadata: { disciplineAction: dto.action },
      },
    });

    this.logger.log(
      `[ADMIN_ACTION] Admin ${adminId} performed ${dto.action} on user ${userId}. Reason: ${dto.reason}`,
    );

    return {
      success: true,
      message: `Successfully executed ${dto.action} for user ${userId}.`,
    };
  }

  /**
   * Authoritatively updates a user's system role (USER, MODERATOR, ADMIN).
   */
  async updateUserRole(
    userId: string,
    role: UserRole,
    adminId: string,
  ): Promise<{ success: boolean; userId: string; role: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User ${userId} not found.`);
    }

    if (!Object.values(UserRole).includes(role)) {
      throw new BadRequestException(`Invalid role: ${role}`);
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { role },
    });

    await this.prisma.moderationAuditLog.create({
      data: {
        moderatorUserId: adminId,
        targetUserId: userId,
        actionType: ModerationActionType.RESTORE_ACCOUNT,
        reason: `User role updated to ${role} by administrator`,
        metadata: { updatedRole: role },
      },
    });

    this.logger.log(
      `[USER_ROLE_UPDATED] User ${userId} role changed to ${role} by admin ${adminId}`,
    );

    return {
      success: true,
      userId,
      role,
    };
  }

  /**
   * Retrieves the queue of profile photos awaiting human moderation.
   */
  async getPendingPhotosQueue(limit = 40): Promise<AdminPhotoQueueItemDto[]> {
    const photos = await this.prisma.profilePhoto.findMany({
      where: { status: PhotoStatus.PENDING_MODERATION },
      include: {
        profile: {
          select: {
            displayName: true,
            userId: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });

    return photos.map((p) => ({
      photoId: p.id,
      userId: p.profile?.userId || '',
      displayName: p.profile?.displayName || 'User',
      photoUrl: this.storageService.getPublicUrl(
        p.mediumKey || p.objectKey || p.thumbnailKey || '',
      ),
      status: p.status as any,
      position: p.position,
      uploadedAt: p.createdAt.toISOString(),
    }));
  }

  /**
   * Authoritatively approves or rejects an uploaded photo.
   */
  async reviewPhoto(
    photoId: string,
    dto: AdminReviewPhotoDto,
    adminId: string,
  ): Promise<{ success: boolean; photoId: string; status: PhotoStatus }> {
    const photo = await this.prisma.profilePhoto.findUnique({
      where: { id: photoId },
      include: { profile: true },
    });

    if (!photo) {
      throw new NotFoundException(`Photo ${photoId} not found.`);
    }

    const newStatus =
      dto.action === 'APPROVE' ? PhotoStatus.APPROVED : PhotoStatus.REJECTED;

    await this.prisma.profilePhoto.update({
      where: { id: photoId },
      data: { status: newStatus },
    });

    // Audit log
    await this.prisma.moderationAuditLog.create({
      data: {
        moderatorUserId: adminId,
        targetUserId: photo.profile?.userId || adminId,
        actionType:
          dto.action === 'APPROVE'
            ? ModerationActionType.RESTORE_ACCOUNT
            : ModerationActionType.REJECT_PHOTO,
        reason: dto.reason || `Admin photo review: ${dto.action}`,
        metadata: { photoId, action: dto.action },
      },
    });

    this.logger.log(
      `[PHOTO_REVIEW] Admin ${adminId} set photo ${photoId} status to ${newStatus}`,
    );

    return {
      success: true,
      photoId,
      status: newStatus,
    };
  }

  /**
   * Retrieves recent financial transactions and purchases.
   */
  async getTransactions(limit = 30): Promise<any[]> {
    const transactions = await this.prisma.purchaseTransaction.findMany({
      include: {
        user: {
          select: {
            id: true,
            phoneNumber: true,
            profile: { select: { displayName: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return transactions.map((t) => ({
      id: t.id,
      userId: t.userId,
      userName: t.user?.profile?.displayName || 'Dating Member',
      userPhone: t.user?.phoneNumber || '',
      productId: t.storeProductId,
      amount: t.amount,
      currency: t.currency,
      status: t.status,
      platform: t.platform,
      provider: t.provider,
      createdAt: t.createdAt.toISOString(),
    }));
  }

  /**
   * Aggregates live monetization, revenue run-rate, subscriber economics,
   * and store product catalogs for the admin revenue dashboard.
   */
  async getRevenueOverview(): Promise<AdminRevenueOverviewDto> {
    const now = new Date();

    // 1. Aggregate completed transactions (Gross Realized Cash)
    const completedAgg = await this.prisma.purchaseTransaction.aggregate({
      where: { status: 'COMPLETED' },
      _sum: { amount: true },
      _count: { id: true },
    });

    const rawPaisa = completedAgg._sum.amount ?? 0;
    const realizedRevenueInr = Number((rawPaisa / 100).toFixed(2));
    const completedCount = completedAgg._count.id ?? 0;
    const averageOrderValueInr =
      completedCount > 0
        ? Number((realizedRevenueInr / completedCount).toFixed(2))
        : 0;

    // 2. Aggregate active subscriptions and tier units
    const activeSubs = await this.prisma.userSubscription.findMany({
      where: {
        status: SubscriptionStatus.ACTIVE,
        expiresAt: { gt: now },
      },
      include: {
        product: true,
      },
    });

    let plusUnits = 0;
    let plusRevenueInr = 0;
    let goldUnits = 0;
    let goldRevenueInr = 0;

    for (const sub of activeSubs) {
      const priceInr = (sub.product?.priceAmount ?? 29900) / 100;
      if (sub.product?.tier === SubscriptionTier.GOLD) {
        goldUnits++;
        goldRevenueInr += priceInr;
      } else {
        plusUnits++;
        plusRevenueInr += priceInr;
      }
    }

    const activeSubscribersCount = activeSubs.length;
    const monthlyRunRateInr = plusRevenueInr + goldRevenueInr;

    // 3. Aggregate consumable micro-packs (Direct notes, boosts, call passes)
    const consumableTx = await this.prisma.purchaseTransaction.findMany({
      where: {
        status: 'COMPLETED',
        OR: [
          { storeProductId: { contains: 'notes', mode: 'insensitive' } },
          { storeProductId: { contains: 'boost', mode: 'insensitive' } },
          { storeProductId: { contains: 'call', mode: 'insensitive' } },
        ],
      },
    });

    const packUnits = consumableTx.length;
    const packRevenueInr = consumableTx.reduce(
      (acc, tx) => acc + (tx.amount / 100),
      0,
    );

    // 4. Aggregate Truelove Coin Wallet Recharges (1-tap micro-transactions)
    const coinTx = await this.prisma.purchaseTransaction.findMany({
      where: {
        status: 'COMPLETED',
        OR: [
          { storeProductId: { contains: 'coin', mode: 'insensitive' } },
          { storeProductId: { contains: 'COIN_PACK', mode: 'insensitive' } },
        ],
      },
    });

    const coinUnits = coinTx.length;
    const coinRevenueInr = coinTx.reduce(
      (acc, tx) => acc + (tx.amount / 100),
      0,
    );

    // 5. Aggregate user coin balances and ledger consumption
    let totalCoinsInCirculation = 0;
    let totalCoinsSpent = 0;
    try {
      const coinCirculationAgg = await this.prisma.userCreditBalance.aggregate({
        _sum: { coins: true },
      });
      totalCoinsInCirculation = coinCirculationAgg._sum.coins ?? 0;

      const coinSpentAgg = await this.prisma.coinTransaction.aggregate({
        where: { amount: { lt: 0 } },
        _sum: { amount: true },
      });
      totalCoinsSpent = Math.abs(coinSpentAgg._sum.amount ?? 0);
    } catch {
      // Graceful fallback if aggregate table empty
    }

    // 6. Query all active store products for dynamic filter mapping
    const products = await this.prisma.subscriptionProduct.findMany({
      where: { isActive: true },
      orderBy: { priceAmount: 'asc' },
    });

    const availableProducts = products.map((p) => ({
      id: p.id,
      storeProductId: p.storeProductId,
      productKey: p.productKey,
      displayName: p.displayName,
      tier: p.tier,
      priceInr: Number((p.priceAmount / 100).toFixed(2)),
    }));

    // 7. Tier breakdown for dashboard cards
    const tierBreakdown = [
      {
        id: 'coin-wallet-recharge',
        tier: 'COIN' as const,
        name: 'Truelove Coin Wallet Recharges',
        priceDisplay: '₹99 (100c) • ₹199 (250c) • ₹499 (700c)',
        description:
          '1-Tap UPI prepaid micro-recharges for direct notes, boosts, calls, and rewinds',
        activeUnits: coinUnits,
        monthlyRevenueInr: Number(coinRevenueInr.toFixed(2)),
      },
      {
        id: 'truelove-gold',
        tier: 'GOLD' as const,
        name: 'Truelove Gold Tier',
        priceDisplay: '₹499 / mo',
        description:
          'See Who Liked You, 5 Direct Notes/wk, 1 Boost/wk, Incognito Mode',
        activeUnits: goldUnits,
        monthlyRevenueInr: Number(goldRevenueInr.toFixed(2)),
      },
      {
        id: 'truelove-plus',
        tier: 'PLUS' as const,
        name: 'Truelove Plus Tier',
        priceDisplay: '₹299 / mo',
        description: 'Unlimited Swipes, Rewind Pass, Passport location travel',
        activeUnits: plusUnits,
        monthlyRevenueInr: Number(plusRevenueInr.toFixed(2)),
      },
      {
        id: 'direct-notes-packs',
        tier: 'PACK' as const,
        name: 'Legacy Micro-Packs & Boosts',
        priceDisplay: '₹99 (5) • ₹199 (15) • ₹349 (30)',
        description: 'Consumable packs purchased before unified coin wallet',
        activeUnits: packUnits,
        monthlyRevenueInr: Number(packRevenueInr.toFixed(2)),
      },
    ];

    return {
      realizedRevenueInr,
      monthlyRunRateInr: Number(monthlyRunRateInr.toFixed(2)),
      completedTransactionsCount: completedCount,
      activeSubscribersCount,
      averageOrderValueInr,
      currency: 'INR',
      tierBreakdown,
      availableProducts,
      benchmarkProjection: {
        projectedMonthlyRunRateInr: 273130,
        projectedSubscribers: 425,
        projectedNotesVolume: 3922,
        projectedProfitMarginPercent: 78.7,
        projectedNetProfitInr: 215000,
      },
      coinMetrics: {
        totalCoinRechargesCount: coinUnits,
        totalCoinRevenueInr: Number(coinRevenueInr.toFixed(2)),
        totalCoinsInCirculation,
        totalCoinsSpent,
      },
    };
  }

  /**
   * Administratively grants coins to a user for support, compensation, or promo.
   */
  async grantCoinsToUser(
    userId: string,
    amount: number,
    reason: string,
    adminId: string,
  ): Promise<{ success: boolean; newBalance: number; message: string }> {
    if (!amount || amount <= 0) {
      throw new BadRequestException('Coin grant amount must be a positive integer.');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found.');
    }

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

    const updated = await this.prisma.userCreditBalance.update({
      where: { userId },
      data: {
        coins: { increment: amount },
      },
    });

    await this.prisma.coinTransaction.create({
      data: {
        userId,
        amount,
        balanceAfter: updated.coins,
        type: CoinTransactionType.ADMIN_GRANT,
        description: reason || `Administrative grant by admin ${adminId}`,
        referenceId: adminId,
      },
    });

    this.logger.log(
      `[ADMIN_COIN_GRANT] Admin ${adminId} granted ${amount} coins to User ${userId}. New balance: ${updated.coins}`,
    );

    return {
      success: true,
      newBalance: updated.coins,
      message: `Successfully granted ${amount} coins to user. New balance: ${updated.coins} coins.`,
    };
  }

  /**
   * Retrieves user's coin transaction history for admin inspection.
   */
  async getUserCoinHistory(userId: string, limit = 20) {
    const transactions = await this.prisma.coinTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return transactions.map((t) => ({
      id: t.id,
      userId: t.userId,
      amount: t.amount,
      balanceAfter: t.balanceAfter,
      type: t.type,
      description: t.description,
      referenceId: t.referenceId,
      createdAt: t.createdAt.toISOString(),
    }));
  }
}

