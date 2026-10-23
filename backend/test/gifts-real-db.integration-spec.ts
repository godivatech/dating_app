import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../src/prisma/prisma.service';
import { CreditService } from '../src/billing/services/credit.service';
import { GiftsService } from '../src/gifts/services/gifts.service';
import { NotificationsService } from '../src/notifications/services/notifications.service';
import { ChatGateway } from '../src/chat/gateways/chat.gateway';
import { GiftType } from '../../shared/src/types';
import { BadRequestException, ConflictException } from '@nestjs/common';

describe('Real PostgreSQL Integration: Atomic Virtual Gifts & Idempotency Races', () => {
  let prisma: PrismaService;
  let creditService: CreditService;
  let giftsService: GiftsService;

  const testSenderId = `test-sender-${Date.now()}`;
  const testReceiverId = `test-receiver-${Date.now()}`;
  const testOtherSenderId = `test-other-${Date.now()}`;

  beforeAll(async () => {
    const mockNotifications = {
      createNotification: jest.fn().mockResolvedValue({ id: 'mock-notif' }),
    };

    const mockChatGateway = {
      server: {
        to: jest.fn().mockReturnValue({
          emit: jest.fn(),
        }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrismaService,
        CreditService,
        GiftsService,
        { provide: NotificationsService, useValue: mockNotifications },
        { provide: ChatGateway, useValue: mockChatGateway },
      ],
    }).compile();

    prisma = module.get<PrismaService>(PrismaService);
    creditService = module.get<CreditService>(CreditService);
    giftsService = module.get<GiftsService>(GiftsService);

    // 1. Seed test users in real PostgreSQL database
    await prisma.user.createMany({
      data: [
        {
          id: testSenderId,
          phoneNumber: `+9199${Math.floor(10000000 + Math.random() * 90000000)}`,
        },
        {
          id: testReceiverId,
          phoneNumber: `+9199${Math.floor(10000000 + Math.random() * 90000000)}`,
        },
        {
          id: testOtherSenderId,
          phoneNumber: `+9199${Math.floor(10000000 + Math.random() * 90000000)}`,
        },
      ],
    });

    // Create profiles
    await prisma.datingProfile.createMany({
      data: [
        {
          id: `prof-${testSenderId}`,
          userId: testSenderId,
          displayName: 'RealDB Sender',
          dateOfBirth: new Date('1996-01-01'),
          gender: 'MAN',
        },
        {
          id: `prof-${testReceiverId}`,
          userId: testReceiverId,
          displayName: 'RealDB Receiver',
          dateOfBirth: new Date('1998-01-01'),
          gender: 'WOMAN',
        },
        {
          id: `prof-${testOtherSenderId}`,
          userId: testOtherSenderId,
          displayName: 'RealDB Stranger',
          dateOfBirth: new Date('1995-01-01'),
          gender: 'MAN',
        },
      ],
    });

    // Grant testSender 100 coins
    await prisma.userCreditBalance.create({
      data: {
        userId: testSenderId,
        coins: 100,
        directNotes: 0,
        profileBoosts: 0,
        callPassMinutes: 0,
      },
    });

    // Grant testOtherSender 100 coins
    await prisma.userCreditBalance.create({
      data: {
        userId: testOtherSenderId,
        coins: 100,
        directNotes: 0,
        profileBoosts: 0,
        callPassMinutes: 0,
      },
    });
  });

  afterAll(async () => {
    // Clean up test data
    try {
      await prisma.virtualGiftTransaction.deleteMany({
        where: {
          OR: [
            { senderUserId: testSenderId },
            { senderUserId: testOtherSenderId },
            { receiverUserId: testReceiverId },
          ],
        },
      });
      await prisma.coinTransaction.deleteMany({
        where: {
          OR: [
            { userId: testSenderId },
            { userId: testOtherSenderId },
          ],
        },
      });
      await prisma.creatorWallet.deleteMany({
        where: { userId: testReceiverId },
      });
      await prisma.userCreditBalance.deleteMany({
        where: {
          userId: { in: [testSenderId, testReceiverId, testOtherSenderId] },
        },
      });
      await prisma.datingProfile.deleteMany({
        where: {
          userId: { in: [testSenderId, testReceiverId, testOtherSenderId] },
        },
      });
      await prisma.user.deleteMany({
        where: {
          id: { in: [testSenderId, testReceiverId, testOtherSenderId] },
        },
      });
    } catch {
      // Ignore cleanup error
    } finally {
      await prisma.$disconnect();
    }
  });

  describe('Real DB Concurrency & Idempotency Guarantees', () => {
    it('Concurrent requests with the same idempotency key result in exactly 1 charge, 1 gift, and 1 creator credit', async () => {
      const idempotencyKey = `real-race-key-${Date.now()}`;

      // Launch 2 concurrent requests with identical key
      const [res1, res2] = await Promise.all([
        giftsService.sendGift(testSenderId, {
          receiverUserId: testReceiverId,
          giftType: GiftType.ROSE, // 10 coins, 500 paise
          idempotencyKey,
        }),
        giftsService.sendGift(testSenderId, {
          receiverUserId: testReceiverId,
          giftType: GiftType.ROSE,
          idempotencyKey,
        }),
      ]);

      // Both requests return success and identical receipt
      expect(res1.success).toBe(true);
      expect(res2.success).toBe(true);
      expect(res1.giftTransactionId).toBe(res2.giftTransactionId);
      expect(res1.coinsSpent).toBe(10);
      expect(res2.coinsSpent).toBe(10);

      // Verify REAL database state: exactly ONE gift transaction
      const gifts = await prisma.virtualGiftTransaction.findMany({
        where: { idempotencyKey },
      });
      expect(gifts.length).toBe(1);
      expect(gifts[0].coinsSpent).toBe(10);

      // Verify REAL database state: exactly ONE coin deduction ledger record
      const coinLedger = await prisma.coinTransaction.findMany({
        where: {
          userId: testSenderId,
          description: { contains: 'Red Rose' },
        },
      });
      expect(coinLedger.length).toBe(1);
      expect(coinLedger[0].amount).toBe(-10);

      // Verify REAL database state: balance is exactly 90 (100 - 10)
      const balance = await prisma.userCreditBalance.findUnique({
        where: { userId: testSenderId },
      });
      expect(balance?.coins).toBe(90);

      // Verify REAL database state: creator wallet credited exactly 500 paise, count 1
      const wallet = await prisma.creatorWallet.findUnique({
        where: { userId: testReceiverId },
      });
      expect(wallet?.balancePaise).toBe(500);
      expect(wallet?.giftsReceivedCount).toBe(1);
    });

    it('Sequential replay with the same key returns committed receipt without extra debit or credit', async () => {
      const idempotencyKey = `real-replay-key-${Date.now()}`;

      // 1. Initial send
      const initial = await giftsService.sendGift(testSenderId, {
        receiverUserId: testReceiverId,
        giftType: GiftType.CHOCOLATE, // 30 coins, 1500 paise
        idempotencyKey,
      });

      expect(initial.success).toBe(true);
      expect(initial.coinsSpent).toBe(30);
      expect(initial.remainingCoins).toBe(60); // 90 - 30 = 60

      // 2. Replay with identical key
      const replay = await giftsService.sendGift(testSenderId, {
        receiverUserId: testReceiverId,
        giftType: GiftType.CHOCOLATE,
        idempotencyKey,
      });

      expect(replay.success).toBe(true);
      expect(replay.giftTransactionId).toBe(initial.giftTransactionId);
      expect(replay.remainingCoins).toBe(60);

      // Check balance is still 60
      const balance = await prisma.userCreditBalance.findUnique({
        where: { userId: testSenderId },
      });
      expect(balance?.coins).toBe(60);

      // Creator wallet incremented only once for chocolate (500 + 1500 = 2000 paise)
      const wallet = await prisma.creatorWallet.findUnique({
        where: { userId: testReceiverId },
      });
      expect(wallet?.balancePaise).toBe(2000);
      expect(wallet?.giftsReceivedCount).toBe(2);
    });

    it('Cross-user key reuse is rejected with ConflictException in real DB', async () => {
      const idempotencyKey = `real-cross-key-${Date.now()}`;

      // User A creates transaction
      await giftsService.sendGift(testSenderId, {
        receiverUserId: testReceiverId,
        giftType: GiftType.ROSE,
        idempotencyKey,
      });

      // User B attempts to send with User A's key
      await expect(
        giftsService.sendGift(testOtherSenderId, {
          receiverUserId: testReceiverId,
          giftType: GiftType.ROSE,
          idempotencyKey,
        }),
      ).rejects.toThrow(ConflictException);

      // User B was NOT charged
      const otherBalance = await prisma.userCreditBalance.findUnique({
        where: { userId: testOtherSenderId },
      });
      expect(otherBalance?.coins).toBe(100);
    });

    it('Mismatched payload replay is rejected with ConflictException in real DB', async () => {
      const idempotencyKey = `real-mismatch-key-${Date.now()}`;

      await giftsService.sendGift(testSenderId, {
        receiverUserId: testReceiverId,
        giftType: GiftType.ROSE,
        idempotencyKey,
      });

      // Same sender replays key but changes gift type to DIAMOND_RING
      await expect(
        giftsService.sendGift(testSenderId, {
          receiverUserId: testReceiverId,
          giftType: GiftType.DIAMOND_RING,
          idempotencyKey,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('Concurrent balance deductions prevent double-spending when balance is insufficient for both', async () => {
      // Set testSender balance to exactly 15 coins
      await prisma.userCreditBalance.update({
        where: { userId: testSenderId },
        data: { coins: 15 },
      });

      // Send 2 concurrent distinct gift requests for Rose (10 coins each = 20 needed, only 15 available)
      const results = await Promise.allSettled([
        giftsService.sendGift(testSenderId, {
          receiverUserId: testReceiverId,
          giftType: GiftType.ROSE,
          idempotencyKey: `real-double-spend-1-${Date.now()}`,
        }),
        giftsService.sendGift(testSenderId, {
          receiverUserId: testReceiverId,
          giftType: GiftType.ROSE,
          idempotencyKey: `real-double-spend-2-${Date.now()}`,
        }),
      ]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      // Exactly ONE request must succeed, and ONE must fail
      expect(fulfilled.length).toBe(1);
      expect(rejected.length).toBe(1);

      // The rejected one failed with insufficient coins BadRequestException
      const rejectionReason: any = (rejected[0] as PromiseRejectedResult).reason;
      expect(rejectionReason).toBeInstanceOf(BadRequestException);
      expect(rejectionReason.message).toContain('Insufficient coins balance');

      // Balance in database is strictly 5 (15 - 10 = 5, NEVER negative)
      const balance = await prisma.userCreditBalance.findUnique({
        where: { userId: testSenderId },
      });
      expect(balance?.coins).toBe(5);
    });
  });
});
