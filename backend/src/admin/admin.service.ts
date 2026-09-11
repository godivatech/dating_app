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
} from '@prisma/client';
import {
  AdminAnalyticsOverviewDto,
  AdminUsersQueryDto,
  AdminUsersListResponse,
  AdminUserListItemDto,
  AdminUserDetailDto,
  AdminDisciplineDto,
  AdminPhotoQueueItemDto,
  AdminReviewPhotoDto,
  SafeProfilePhoto,
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
  ) {}

  /**
   * Aggregates real-time business and system KPIs for the admin dashboard.
   */
  async getAnalyticsOverview(): Promise<AdminAnalyticsOverviewDto> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [
      totalUsers,
      activeToday,
      verifiedUsers,
      totalMatches,
      sparkPlusSubs,
      sparkGoldSubs,
      directNotesCount,
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
      this.prisma.match.count(),
      this.prisma.userSubscription.count({
        where: {
          product: { tier: SubscriptionTier.PLUS },
          status: SubscriptionStatus.ACTIVE,
        },
      }),
      this.prisma.userSubscription.count({
        where: {
          product: { tier: SubscriptionTier.GOLD },
          status: SubscriptionStatus.ACTIVE,
        },
      }),
      this.prisma.userAction.count({
        where: { note: { not: null } },
      }),
      this.prisma.report.count({
        where: { status: ReportStatus.OPEN },
      }),
      this.prisma.profilePhoto.count({
        where: { status: PhotoStatus.PENDING_MODERATION },
      }),
    ]);

    // Estimated monthly gross run-rate (INR)
    const estimatedMonthlyRevenueInr =
      sparkPlusSubs * 299 +
      sparkGoldSubs * 499 +
      Math.floor(directNotesCount * 25);

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
      directNotePacksCount: directNotesCount,
      pendingReportsCount,
      pendingPhotosCount,
      estimatedMonthlyRevenueInr,
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
      const photoUrl = primaryPhoto?.thumbnailKey
        ? this.storageService.getPublicUrl(primaryPhoto.thumbnailKey)
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
            thumbnailUrl: p.thumbnailKey
              ? this.storageService.getPublicUrl(p.thumbnailKey)
              : null,
            mediumUrl: p.mediumKey
              ? this.storageService.getPublicUrl(p.mediumKey)
              : null,
            largeUrl: p.largeKey
              ? this.storageService.getPublicUrl(p.largeKey)
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

    // If no pending photos, return recent photos for inspection
    const sourcePhotos =
      photos.length > 0
        ? photos
        : await this.prisma.profilePhoto.findMany({
            include: {
              profile: {
                select: {
                  displayName: true,
                  userId: true,
                },
              },
            },
            orderBy: { createdAt: 'desc' },
            take: 20,
          });

    return sourcePhotos.map((p) => ({
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
}
