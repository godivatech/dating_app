import { Test, TestingModule } from '@nestjs/testing';
import { GiftsService } from './gifts.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CreditService } from '../../billing/services/credit.service';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { ChatGateway } from '../../chat/gateways/chat.gateway';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { GiftType } from '../../../../shared/src/types';
import { Prisma } from '@prisma/client';

describe('GiftsService (Atomic Transactions & Idempotency)', () => {
  let service: GiftsService;
  let prisma: any;
  let creditService: any;
  let notificationsService: any;
  let chatGateway: any;

  const senderId = 'sender-1';
  const receiverId = 'receiver-1';

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn().mockImplementation(({ where }) => {
          if (where.id === receiverId) {
            return Promise.resolve({
              id: receiverId,
              profile: { displayName: 'Receiver Alice' },
            });
          }
          if (where.id === senderId) {
            return Promise.resolve({
              id: senderId,
              profile: { displayName: 'Sender Bob' },
            });
          }
          return Promise.resolve(null);
        }),
      },
      virtualGiftTransaction: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
      },
      creatorWallet: {
        upsert: jest.fn(),
      },
      userCreditBalance: {
        findUnique: jest.fn().mockResolvedValue({ coins: 40 }),
      },
      $transaction: jest.fn(),
    };

    creditService = {
      deductCoins: jest.fn(),
      getOrCreateBalance: jest.fn().mockResolvedValue({ coins: 40 }),
    };

    notificationsService = {
      createNotification: jest.fn().mockResolvedValue({ id: 'notif-1' }),
    };

    chatGateway = {
      server: {
        to: jest.fn().mockReturnValue({
          emit: jest.fn(),
        }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GiftsService,
        { provide: PrismaService, useValue: prisma },
        { provide: CreditService, useValue: creditService },
        { provide: NotificationsService, useValue: notificationsService },
        { provide: ChatGateway, useValue: chatGateway },
      ],
    }).compile();

    service = module.get<GiftsService>(GiftsService);
  });

  describe('Atomicity & Rollback Guarantees', () => {
    it('Coin deduction failure leaves no gift or creator credit', async () => {
      // Mock $transaction executing the inner callback
      prisma.$transaction.mockImplementation(async (callback: any) => {
        // Step A: deductCoins returns false (insufficient coins)
        creditService.deductCoins.mockResolvedValueOnce(false);
        return callback(prisma);
      });

      await expect(
        service.sendGift(senderId, {
          receiverUserId: receiverId,
          giftType: GiftType.ROSE,
        }),
      ).rejects.toThrow(BadRequestException);

      // Verify no gift transaction created and no creator wallet upserted
      expect(prisma.virtualGiftTransaction.create).not.toHaveBeenCalled();
      expect(prisma.creatorWallet.upsert).not.toHaveBeenCalled();
    });

    it('Gift creation failure rolls back coin deduction', async () => {
      let rolledBack = false;

      prisma.$transaction.mockImplementation(async (callback: any) => {
        creditService.deductCoins.mockResolvedValueOnce(true);
        prisma.virtualGiftTransaction.create.mockRejectedValueOnce(
          new Error('DB Connection Timeout during gift insertion'),
        );

        try {
          return await callback(prisma);
        } catch (err) {
          rolledBack = true;
          throw err;
        }
      });

      await expect(
        service.sendGift(senderId, {
          receiverUserId: receiverId,
          giftType: GiftType.ROSE,
        }),
      ).rejects.toThrow('DB Connection Timeout during gift insertion');

      expect(rolledBack).toBe(true);
      // Verify creator wallet was never touched because step B threw
      expect(prisma.creatorWallet.upsert).not.toHaveBeenCalled();
    });

    it('Creator wallet credit failure rolls back the entire transaction', async () => {
      let rolledBack = false;

      prisma.$transaction.mockImplementation(async (callback: any) => {
        creditService.deductCoins.mockResolvedValueOnce(true);
        prisma.virtualGiftTransaction.create.mockResolvedValueOnce({
          id: 'gift-tx-1',
          senderUserId: senderId,
          receiverUserId: receiverId,
          giftType: GiftType.ROSE,
          coinsSpent: 10,
        });
        prisma.creatorWallet.upsert.mockRejectedValueOnce(
          new Error('Deadlock on CreatorWallet row lock'),
        );

        try {
          return await callback(prisma);
        } catch (err) {
          rolledBack = true;
          throw err;
        }
      });

      await expect(
        service.sendGift(senderId, {
          receiverUserId: receiverId,
          giftType: GiftType.ROSE,
        }),
      ).rejects.toThrow('Deadlock on CreatorWallet row lock');

      expect(rolledBack).toBe(true);
    });
  });

  describe('Idempotency & Replay Handling', () => {
    it('A replay returns the original receipt without debiting or crediting again', async () => {
      const idempotencyKey = 'client-req-uuid-1111';
      const existingCommittedGift = {
        id: 'gift-tx-existing-1',
        senderUserId: senderId,
        receiverUserId: receiverId,
        giftType: GiftType.ROSE,
        coinsSpent: 10,
        idempotencyKey,
      };

      // Pre-check finds existing committed transaction
      prisma.virtualGiftTransaction.findUnique.mockResolvedValueOnce(
        existingCommittedGift,
      );
      creditService.getOrCreateBalance.mockResolvedValueOnce({ coins: 30 });

      const response = await service.sendGift(senderId, {
        receiverUserId: receiverId,
        giftType: GiftType.ROSE,
        idempotencyKey,
      });

      expect(response).toEqual({
        success: true,
        giftTransactionId: 'gift-tx-existing-1',
        giftType: GiftType.ROSE,
        coinsSpent: 10,
        remainingCoins: 30,
        receiverDisplayName: 'Receiver Alice',
      });

      // No new transaction was initiated
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(creditService.deductCoins).not.toHaveBeenCalled();
      expect(prisma.creatorWallet.upsert).not.toHaveBeenCalled();
    });

    it('Cross-user key reuse is rejected with ConflictException', async () => {
      const idempotencyKey = 'shared-key-stolen';
      const userATx = {
        id: 'gift-tx-user-a',
        senderUserId: 'user-attacker-victim-A',
        receiverUserId: receiverId,
        giftType: GiftType.ROSE,
        coinsSpent: 10,
        idempotencyKey,
      };

      // Key already committed by another sender
      prisma.virtualGiftTransaction.findUnique.mockResolvedValueOnce(userATx);

      await expect(
        service.sendGift(senderId, {
          receiverUserId: receiverId,
          giftType: GiftType.ROSE,
          idempotencyKey,
        }),
      ).rejects.toThrow(ConflictException);

      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(creditService.deductCoins).not.toHaveBeenCalled();
    });

    it('Mismatched payload replay with different receiver is rejected with ConflictException', async () => {
      const idempotencyKey = 'key-diff-params-1';
      const existingTx = {
        id: 'gift-tx-original',
        senderUserId: senderId,
        receiverUserId: 'original-receiver-id',
        giftType: GiftType.ROSE,
        coinsSpent: 10,
        idempotencyKey,
      };

      prisma.virtualGiftTransaction.findUnique.mockResolvedValueOnce(existingTx);

      await expect(
        service.sendGift(senderId, {
          receiverUserId: receiverId, // Different receiver
          giftType: GiftType.ROSE,
          idempotencyKey,
        }),
      ).rejects.toThrow(ConflictException);

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('Mismatched payload replay with different giftType is rejected with ConflictException', async () => {
      const idempotencyKey = 'key-diff-params-2';
      const existingTx = {
        id: 'gift-tx-original',
        senderUserId: senderId,
        receiverUserId: receiverId,
        giftType: GiftType.ROSE,
        coinsSpent: 10,
        idempotencyKey,
      };

      prisma.virtualGiftTransaction.findUnique.mockResolvedValueOnce(existingTx);

      await expect(
        service.sendGift(senderId, {
          receiverUserId: receiverId,
          giftType: GiftType.DIAMOND_RING, // Different gift type!
          idempotencyKey,
        }),
      ).rejects.toThrow(ConflictException);

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('Mismatched payload replay with different conversationId is rejected with ConflictException', async () => {
      const idempotencyKey = 'key-diff-params-3';
      const existingTx = {
        id: 'gift-tx-original',
        senderUserId: senderId,
        receiverUserId: receiverId,
        giftType: GiftType.ROSE,
        conversationId: 'conv-111',
        coinsSpent: 10,
        idempotencyKey,
      };

      prisma.virtualGiftTransaction.findUnique.mockResolvedValueOnce(existingTx);

      await expect(
        service.sendGift(senderId, {
          receiverUserId: receiverId,
          giftType: GiftType.ROSE,
          conversationId: 'conv-222', // Different conversation!
          idempotencyKey,
        }),
      ).rejects.toThrow(ConflictException);

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('Concurrent requests with the same idempotency key produce one charge and return original receipt on race', async () => {
      const idempotencyKey = 'race-key-2222';
      const committedGiftTx = {
        id: 'gift-tx-race-winner',
        senderUserId: senderId,
        receiverUserId: receiverId,
        giftType: GiftType.CHOCOLATE,
        coinsSpent: 30,
        idempotencyKey,
      };

      // In the concurrent loser request:
      // 1. Initial pre-check didn't find the key yet (in flight)
      prisma.virtualGiftTransaction.findUnique
        .mockResolvedValueOnce(null) // pre-check
        .mockResolvedValueOnce(committedGiftTx); // post-rollback lookup

      // 2. $transaction fails with Prisma P2002 unique constraint violation on idempotencyKey
      const prismaUniqueError = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed on the fields: (`idempotencyKey`)',
        {
          code: 'P2002',
          clientVersion: '6.4.1',
          meta: { target: ['idempotencyKey'] },
        },
      );

      prisma.$transaction.mockRejectedValueOnce(prismaUniqueError);
      creditService.getOrCreateBalance.mockResolvedValueOnce({ coins: 70 });

      const result = await service.sendGift(senderId, {
        receiverUserId: receiverId,
        giftType: GiftType.CHOCOLATE,
        idempotencyKey,
      });

      expect(result).toEqual({
        success: true,
        giftTransactionId: 'gift-tx-race-winner',
        giftType: GiftType.CHOCOLATE,
        coinsSpent: 30,
        remainingCoins: 70,
        receiverDisplayName: 'Receiver Alice',
      });
    });

    it('Different idempotency keys permit distinct legitimate gifts', async () => {
      const tx1Data = {
        id: 'gift-tx-alpha',
        coinsSpent: 10,
        giftType: GiftType.ROSE,
      };
      const tx2Data = {
        id: 'gift-tx-beta',
        coinsSpent: 10,
        giftType: GiftType.ROSE,
      };

      // Call 1
      prisma.virtualGiftTransaction.findUnique.mockResolvedValueOnce(null);
      prisma.$transaction.mockImplementationOnce(async (callback: any) => {
        creditService.deductCoins.mockResolvedValueOnce(true);
        prisma.virtualGiftTransaction.create.mockResolvedValueOnce(tx1Data);
        prisma.creatorWallet.upsert.mockResolvedValueOnce({});
        prisma.userCreditBalance.findUnique.mockResolvedValueOnce({ coins: 30 });
        return callback(prisma);
      });

      const res1 = await service.sendGift(senderId, {
        receiverUserId: receiverId,
        giftType: GiftType.ROSE,
        idempotencyKey: 'key-alpha',
      });

      // Call 2
      prisma.virtualGiftTransaction.findUnique.mockResolvedValueOnce(null);
      prisma.$transaction.mockImplementationOnce(async (callback: any) => {
        creditService.deductCoins.mockResolvedValueOnce(true);
        prisma.virtualGiftTransaction.create.mockResolvedValueOnce(tx2Data);
        prisma.creatorWallet.upsert.mockResolvedValueOnce({});
        prisma.userCreditBalance.findUnique.mockResolvedValueOnce({ coins: 20 });
        return callback(prisma);
      });

      const res2 = await service.sendGift(senderId, {
        receiverUserId: receiverId,
        giftType: GiftType.ROSE,
        idempotencyKey: 'key-beta',
      });

      expect(res1.giftTransactionId).toBe('gift-tx-alpha');
      expect(res2.giftTransactionId).toBe('gift-tx-beta');
      expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    });

    it('Requests without an idempotency key retain legacy behavior without collisions', async () => {
      prisma.$transaction.mockImplementationOnce(async (callback: any) => {
        creditService.deductCoins.mockResolvedValueOnce(true);
        prisma.virtualGiftTransaction.create.mockImplementationOnce(({ data }) => {
          expect(data.idempotencyKey).toBeNull();
          return Promise.resolve({
            id: 'legacy-gift-1',
            ...data,
          });
        });
        prisma.creatorWallet.upsert.mockResolvedValueOnce({});
        prisma.userCreditBalance.findUnique.mockResolvedValueOnce({ coins: 20 });
        return callback(prisma);
      });

      const res = await service.sendGift(senderId, {
        receiverUserId: receiverId,
        giftType: GiftType.ROSE,
      });

      expect(res.success).toBe(true);
      expect(res.giftTransactionId).toBe('legacy-gift-1');
      // No idempotency lookup was performed when key is omitted
      expect(prisma.virtualGiftTransaction.findUnique).not.toHaveBeenCalled();
    });
  });
});
