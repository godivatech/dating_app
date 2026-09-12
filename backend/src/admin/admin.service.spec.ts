import { AdminService } from './admin.service';
import { PrismaService } from '../prisma/prisma.service';
import { DiscoveryPaginationService } from '../discovery/services/discovery-pagination.service';
import { StorageService } from '../media/storage/storage.interface';
import {
  UserStatus,
  UserRole,
  PhotoStatus,
  ProfileStatus,
  ProfileVisibility,
  Gender,
  SubscriptionTier,
  SubscriptionStatus,
} from '@prisma/client';
import { NotFoundException } from '@nestjs/common';

describe('AdminService', () => {
  let service: AdminService;
  let mockPrisma: any;
  let mockPagination: DiscoveryPaginationService;
  let mockStorage: any;

  const mockUser = {
    id: 'user-admin-test-1',
    phoneNumber: '+919876543210',
    status: UserStatus.ACTIVE,
    role: UserRole.USER,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    lastLoginAt: new Date(),
    messagingRestrictedUntil: null,
    shadowBannedUntil: null,
    profile: {
      id: 'profile-1',
      displayName: 'Karthik',
      dateOfBirth: new Date('1998-05-15T00:00:00.000Z'),
      gender: Gender.MAN,
      bio: 'Software engineer in Chennai',
      locationCity: 'Chennai',
      locationRegion: 'Tamil Nadu',
      locationCountry: 'IN',
      status: ProfileStatus.READY,
      visibility: ProfileVisibility.VISIBLE,
      photos: [
        {
          id: 'photo-1',
          profileId: 'profile-1',
          status: PhotoStatus.APPROVED,
          position: 0,
          thumbnailKey: 'thumb.webp',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      interests: [],
      preferences: null,
    },
    safetyStrikes: [],
    subscriptions: [
      {
        product: { tier: SubscriptionTier.GOLD },
        status: SubscriptionStatus.ACTIVE,
        expiresAt: new Date(),
      },
    ],
  };

  beforeEach(() => {
    mockPrisma = {
      user: {
        count: jest.fn().mockResolvedValue(100),
        findMany: jest.fn().mockResolvedValue([mockUser]),
        findUnique: jest.fn().mockResolvedValue(mockUser),
        update: jest.fn().mockResolvedValue(mockUser),
      },
      match: {
        count: jest.fn().mockResolvedValue(25),
      },
      subscription: {
        count: jest.fn().mockResolvedValue(15),
      },
      userSubscription: {
        count: jest.fn().mockResolvedValue(15),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'sub-1',
            status: SubscriptionStatus.ACTIVE,
            expiresAt: new Date(Date.now() + 86400000),
            product: {
              id: 'prod-gold',
              tier: SubscriptionTier.GOLD,
              priceAmount: 49900,
            },
          },
        ]),
      },
      subscriptionProduct: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'prod-gold',
            storeProductId: 'com.sparkdating.gold.1m',
            productKey: 'SPARK_GOLD_1M',
            displayName: 'Truelove Gold Tier',
            tier: 'GOLD',
            priceAmount: 49900,
          },
        ]),
      },
      userAction: {
        count: jest.fn().mockResolvedValue(40),
      },
      report: {
        count: jest.fn().mockResolvedValue(3),
      },
      profilePhoto: {
        count: jest.fn().mockResolvedValue(5),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'photo-p1',
            profileId: 'profile-1',
            status: PhotoStatus.PENDING_REVIEW,
            position: 1,
            thumbnailKey: 'pending.webp',
            createdAt: new Date(),
            profile: { displayName: 'Karthik', userId: 'user-admin-test-1' },
          },
        ]),
        findUnique: jest.fn().mockResolvedValue({
          id: 'photo-p1',
          status: PhotoStatus.PENDING_REVIEW,
          profile: { userId: 'user-admin-test-1' },
        }),
        update: jest.fn().mockResolvedValue({
          id: 'photo-p1',
          status: PhotoStatus.APPROVED,
        }),
      },
      userSafetyStrike: {
        create: jest.fn().mockResolvedValue({ id: 'strike-1' }),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      moderationAuditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
      },
      purchaseTransaction: {
        count: jest.fn().mockResolvedValue(40),
        aggregate: jest.fn().mockResolvedValue({
          _sum: { amount: 49900 },
          _count: { id: 1 },
        }),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'tx-1',
            userId: 'user-admin-test-1',
            storeProductId: 'com.sparkdating.gold.1m',
            amount: 49900,
            currency: 'INR',
            status: 'COMPLETED',
            platform: 'ANDROID',
            provider: 'GOOGLE',
            createdAt: new Date(),
            user: {
              id: 'user-admin-test-1',
              phoneNumber: '+919876543210',
              profile: { displayName: 'Karthik' },
            },
          },
        ]),
      },
      authSession: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      $transaction: jest.fn().mockImplementation((cb) => cb(mockPrisma)),
    };

    mockPagination = new DiscoveryPaginationService();
    mockStorage = {
      getPublicUrl: jest.fn((key) => `https://cdn.sparkdating.com/${key}`),
    };
    const mockNotifications: any = {
      createNotification: jest.fn().mockResolvedValue({ id: 'notif-1' }),
    };

    service = new AdminService(
      mockPrisma as PrismaService,
      mockPagination,
      mockStorage as StorageService,
      mockNotifications,
    );
  });

  describe('getAnalyticsOverview', () => {
    it('aggregates user counts, subscriptions, matches, and revenue', async () => {
      const overview = await service.getAnalyticsOverview();

      expect(overview.totalUsers).toBe(100);
      expect(overview.totalMatches).toBe(25);
      expect(overview.activeSubscriptions.sparkPlus).toBe(15);
      expect(overview.activeSubscriptions.sparkGold).toBe(15);
      expect(overview.directNotePacksCount).toBe(40);
      expect(overview.pendingReportsCount).toBe(3);
      expect(overview.pendingPhotosCount).toBe(5);
      expect(overview.estimatedMonthlyRevenueInr).toBeGreaterThan(0);
    });
  });

  describe('searchUsers', () => {
    it('returns filtered and paginated users with mapped profile info', async () => {
      const res = await service.searchUsers({
        search: 'Karthik',
        limit: 10,
      });

      expect(res.totalCount).toBe(100);
      expect(res.users.length).toBe(1);
      expect(res.users[0].displayName).toBe('Karthik');
      expect(res.users[0].phoneNumber).toBe('+919876543210');
      expect(res.users[0].primaryPhotoUrl).toBe(
        'https://cdn.sparkdating.com/thumb.webp',
      );
    });
  });

  describe('getUserDetail', () => {
    it('returns 360-degree user dossier', async () => {
      const detail = await service.getUserDetail('user-admin-test-1');

      expect(detail.id).toBe('user-admin-test-1');
      expect(detail.profile?.displayName).toBe('Karthik');
      expect(detail.profile?.locationCity).toBe('Chennai');
      expect(detail.subscription?.planType).toBe(SubscriptionTier.GOLD);
      expect(detail.mutualMatchesCount).toBe(25);
      expect(detail.directNotesSentCount).toBe(40);
    });

    it('throws NotFoundException if user does not exist', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getUserDetail('unknown-user')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateUserDiscipline', () => {
    it('applies manual 24H MUTE and writes audit log', async () => {
      const res = await service.updateUserDiscipline(
        'user-admin-test-1',
        { action: 'MUTE_24H', reason: 'Abusive language in bio' },
        'admin-operator-1',
      );

      expect(res.success).toBe(true);
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-admin-test-1' },
          data: expect.objectContaining({
            messagingRestrictedUntil: expect.any(Date),
          }),
        }),
      );
      expect(mockPrisma.moderationAuditLog.create).toHaveBeenCalled();
    });

    it('applies manual BAN and revokes active sessions', async () => {
      const res = await service.updateUserDiscipline(
        'user-admin-test-1',
        { action: 'BAN', reason: 'Critical scam solicitation' },
        'admin-operator-1',
      );

      expect(res.success).toBe(true);
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: UserStatus.BANNED },
        }),
      );
      expect(mockPrisma.authSession.updateMany).toHaveBeenCalled();
    });

    it('unbans a previously restricted user', async () => {
      const res = await service.updateUserDiscipline(
        'user-admin-test-1',
        { action: 'UNBAN', reason: 'False positive appeal accepted' },
        'admin-operator-1',
      );

      expect(res.success).toBe(true);
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            status: UserStatus.ACTIVE,
            messagingRestrictedUntil: null,
            shadowBannedUntil: null,
          },
        }),
      );
    });
  });

  describe('Photo Review & Transactions', () => {
    it('retrieves pending photo moderation queue', async () => {
      const queue = await service.getPendingPhotosQueue();

      expect(queue.length).toBe(1);
      expect(queue[0].photoId).toBe('photo-p1');
      expect(queue[0].displayName).toBe('Karthik');
      expect(queue[0].photoUrl).toContain('https://cdn.sparkdating.com/');
    });

    it('approves a photo and updates status', async () => {
      const res = await service.reviewPhoto(
        'photo-p1',
        { action: 'APPROVE' },
        'admin-1',
      );

      expect(res.success).toBe(true);
      expect(res.status).toBe(PhotoStatus.APPROVED);
      expect(mockPrisma.profilePhoto.update).toHaveBeenCalledWith({
        where: { id: 'photo-p1' },
        data: { status: PhotoStatus.APPROVED },
      });
    });

    it('retrieves recent financial transactions', async () => {
      const txs = await service.getTransactions();

      expect(txs.length).toBe(1);
      expect(txs[0].amount).toBe(49900);
      expect(txs[0].productId).toBe('com.sparkdating.gold.1m');
    });

    it('aggregates live revenue overview, MRR, tier performance, and products', async () => {
      const overview = await service.getRevenueOverview();

      expect(overview.realizedRevenueInr).toBe(499);
      expect(overview.completedTransactionsCount).toBe(1);
      expect(overview.activeSubscribersCount).toBe(1);
      expect(overview.monthlyRunRateInr).toBe(499);
      expect(overview.tierBreakdown.length).toBe(4);
      expect(overview.availableProducts.length).toBe(1);
      expect(overview.availableProducts[0].storeProductId).toBe('com.sparkdating.gold.1m');
      expect(overview.benchmarkProjection.projectedMonthlyRunRateInr).toBe(273130);
    });
  });
});

