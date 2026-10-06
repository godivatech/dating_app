import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreditService } from '../../billing/services/credit.service';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { ChatGateway } from '../../chat/gateways/chat.gateway';
import { SendGiftDto } from '../dto/send-gift.dto';
import { RequestPayoutDto } from '../dto/payout-request.dto';
import {
  GiftType,
  PayoutStatus,
  GiftCatalogItem,
  SendGiftResponseDto,
  CreatorWalletDto,
  CreatorPayoutRequestDto,
  NotificationType,
} from '../../../../shared/src/types';
import { CoinTransactionType } from '@prisma/client';

export const GIFT_CATALOG: Record<
  GiftType,
  {
    displayName: string;
    coinsCost: number;
    platformFeeCoins: number;
    creatorEarningsPaise: number;
    displayEarningsInr: string;
    iconName: string;
    iconFamily: 'Ionicons' | 'MaterialCommunityIcons' | 'Feather';
    description: string;
  }
> = {
  [GiftType.ROSE]: {
    displayName: 'Red Rose',
    coinsCost: 10,
    platformFeeCoins: 5,
    creatorEarningsPaise: 500, // ₹5.00
    displayEarningsInr: '₹5.00',
    iconName: 'flower-tulip',
    iconFamily: 'MaterialCommunityIcons',
    description: 'A classic symbol of romantic admiration and interest.',
  },
  [GiftType.CHOCOLATE]: {
    displayName: 'Artisan Chocolates',
    coinsCost: 30,
    platformFeeCoins: 15,
    creatorEarningsPaise: 1500, // ₹15.00
    displayEarningsInr: '₹15.00',
    iconName: 'gift',
    iconFamily: 'Feather',
    description: 'Sweet gourmet treats to sweeten the conversation.',
  },
  [GiftType.TEDDY_BEAR]: {
    displayName: 'Teddy Bear',
    coinsCost: 70,
    platformFeeCoins: 35,
    creatorEarningsPaise: 3500, // ₹35.00
    displayEarningsInr: '₹35.00',
    iconName: 'teddy-bear',
    iconFamily: 'MaterialCommunityIcons',
    description: 'A cuddly companion showing genuine warmth and affection.',
  },
  [GiftType.DIAMOND_RING]: {
    displayName: 'Diamond Ring',
    coinsCost: 150,
    platformFeeCoins: 75,
    creatorEarningsPaise: 7500, // ₹75.00
    displayEarningsInr: '₹75.00',
    iconName: 'diamond-outline',
    iconFamily: 'Ionicons',
    description: 'A sparkling premium token reserved for someone truly special.',
  },
  [GiftType.ROYAL_CROWN]: {
    displayName: 'Royal Crown',
    coinsCost: 300,
    platformFeeCoins: 150,
    creatorEarningsPaise: 15000, // ₹150.00
    displayEarningsInr: '₹150.00',
    iconName: 'crown',
    iconFamily: 'MaterialCommunityIcons',
    description: 'The highest honor in Truelove—treat her like royalty.',
  },
};

@Injectable()
export class GiftsService {
  private readonly logger = new Logger(GiftsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly creditService: CreditService,
    private readonly notificationsService: NotificationsService,
    @Inject(forwardRef(() => ChatGateway))
    private readonly chatGateway: ChatGateway,
  ) {}

  /**
   * Retrieves the gift catalog with coin prices and creator earnings.
   */
  getCatalog(): GiftCatalogItem[] {
    return Object.entries(GIFT_CATALOG).map(([key, item]) => ({
      id: key as GiftType,
      displayName: item.displayName,
      coinsCost: item.coinsCost,
      iconName: item.iconName,
      iconFamily: item.iconFamily,
      description: item.description,
      creatorEarningsPaise: item.creatorEarningsPaise,
      displayEarningsInr: item.displayEarningsInr,
    }));
  }

  /**
   * Sends a virtual gift to another user, deducting coins from sender,
   * taking a 50% platform cut, and crediting 50% to the receiver's Creator Wallet.
   */
  async sendGift(
    senderUserId: string,
    dto: SendGiftDto,
  ): Promise<SendGiftResponseDto> {
    if (senderUserId === dto.receiverUserId) {
      throw new BadRequestException('You cannot send a gift to yourself.');
    }

    const giftDef = GIFT_CATALOG[dto.giftType];
    if (!giftDef) {
      throw new BadRequestException(`Invalid gift type: ${dto.giftType}`);
    }

    // Verify receiver exists
    const receiver = await this.prisma.user.findUnique({
      where: { id: dto.receiverUserId },
      include: { profile: { select: { displayName: true } } },
    });

    if (!receiver) {
      throw new NotFoundException('Receiver user was not found.');
    }

    // Fetch sender display name
    const sender = await this.prisma.user.findUnique({
      where: { id: senderUserId },
      include: { profile: { select: { displayName: true } } },
    });
    const senderDisplayName = sender?.profile?.displayName || 'Someone';
    const receiverDisplayName = receiver?.profile?.displayName || 'User';

    // 1. Deduct coins from sender atomically
    const deducted = await this.creditService.deductCoins(
      senderUserId,
      giftDef.coinsCost,
      CoinTransactionType.SPEND_VIRTUAL_GIFT,
      `Sent ${giftDef.displayName} to ${receiverDisplayName}`,
      dto.receiverUserId,
    );

    if (!deducted) {
      throw new BadRequestException(
        `Insufficient coins balance. You need ${giftDef.coinsCost} coins to send a ${giftDef.displayName}.`,
      );
    }

    // 2. Perform atomic recording and wallet credit
    const { giftTx, updatedWallet } = await this.prisma.$transaction(
      async (tx) => {
        // Record gift transaction
        const giftTx = await tx.virtualGiftTransaction.create({
          data: {
            senderUserId,
            receiverUserId: dto.receiverUserId,
            giftType: dto.giftType as any,
            coinsSpent: giftDef.coinsCost,
            platformFeeCoins: giftDef.platformFeeCoins,
            creatorEarningPaise: giftDef.creatorEarningsPaise,
            conversationId: dto.conversationId || null,
            callId: dto.callId || null,
          },
        });

        // Ensure creator wallet exists and credit earnings
        const updatedWallet = await tx.creatorWallet.upsert({
          where: { userId: dto.receiverUserId },
          create: {
            userId: dto.receiverUserId,
            balancePaise: giftDef.creatorEarningsPaise,
            totalEarnedPaise: giftDef.creatorEarningsPaise,
            giftsReceivedCount: 1,
          },
          update: {
            balancePaise: { increment: giftDef.creatorEarningsPaise },
            totalEarnedPaise: { increment: giftDef.creatorEarningsPaise },
            giftsReceivedCount: { increment: 1 },
          },
        });

        return { giftTx, updatedWallet };
      },
    );

    this.logger.log(
      `[GIFT_SENT] ${senderUserId} -> ${dto.receiverUserId}: ${giftDef.displayName} (${giftDef.coinsCost} coins). Receiver earned ₹${(giftDef.creatorEarningsPaise / 100).toFixed(2)}`,
    );

    // 3. Dispatch in-app notification to receiver
    try {
      await this.notificationsService.createNotification(
        dto.receiverUserId,
        {
          type: NotificationType.SYSTEM,
          title: `🎁 ${senderDisplayName} sent you a gift!`,
          body: `You received a ${giftDef.displayName} (+₹${(giftDef.creatorEarningsPaise / 100).toFixed(0)} added to your Creator Wallet)!`,
          metadata: {
            subType: 'GIFT_RECEIVED',
            giftType: dto.giftType,
            giftTransactionId: giftTx.id,
            senderUserId,
            conversationId: dto.conversationId,
          },
        },
      );
    } catch (err: any) {
      this.logger.warn(
        `[GIFT_NOTIFICATION_ERROR] Failed to send push notification: ${err.message}`,
      );
    }

    // 4. Broadcast live socket events if in chat conversation
    try {
      if (this.chatGateway?.server) {
        // Broadcast to receiver's user room
        this.chatGateway.server
          .to(`user:${dto.receiverUserId}`)
          .emit('gift.received', {
            giftTransactionId: giftTx.id,
            giftType: dto.giftType,
            displayName: giftDef.displayName,
            senderUserId,
            senderDisplayName,
            creatorEarningsPaise: giftDef.creatorEarningsPaise,
            conversationId: dto.conversationId,
          });

        // If conversationId provided, broadcast to conversation room as well
        if (dto.conversationId) {
          this.chatGateway.server
            .to(`conversation:${dto.conversationId}`)
            .emit('gift.received', {
              giftTransactionId: giftTx.id,
              giftType: dto.giftType,
              displayName: giftDef.displayName,
              senderUserId,
              senderDisplayName,
              creatorEarningsPaise: giftDef.creatorEarningsPaise,
              conversationId: dto.conversationId,
            });
        }
      }
    } catch (err: any) {
      this.logger.warn(`[GIFT_SOCKET_ERROR] Socket broadcast error: ${err.message}`);
    }

    // 5. Get sender's remaining coin balance
    const senderBalance = await this.creditService.getOrCreateBalance(senderUserId);

    return {
      success: true,
      giftTransactionId: giftTx.id,
      giftType: dto.giftType,
      coinsSpent: giftDef.coinsCost,
      remainingCoins: senderBalance.coins,
      receiverDisplayName,
    };
  }

  /**
   * Retrieves the creator's wallet summary and balance.
   */
  async getCreatorWallet(userId: string): Promise<CreatorWalletDto> {
    let wallet = await this.prisma.creatorWallet.findUnique({
      where: { userId },
    });

    if (!wallet) {
      wallet = await this.prisma.creatorWallet.create({
        data: {
          userId,
          balancePaise: 0,
          totalEarnedPaise: 0,
          totalWithdrawnPaise: 0,
          giftsReceivedCount: 0,
        },
      });
    }

    return {
      balancePaise: wallet.balancePaise,
      balanceInr: wallet.balancePaise / 100,
      totalEarnedPaise: wallet.totalEarnedPaise,
      totalEarnedInr: wallet.totalEarnedPaise / 100,
      totalWithdrawnPaise: wallet.totalWithdrawnPaise,
      totalWithdrawnInr: wallet.totalWithdrawnPaise / 100,
      giftsReceivedCount: wallet.giftsReceivedCount,
      upiId: wallet.upiId,
      accountHolderName: wallet.accountHolderName,
      isKycVerified: wallet.isKycVerified,
      minWithdrawalPaise: 50000, // ₹500.00
    };
  }

  /**
   * Creates a payout request to transfer earned balance to the creator's UPI ID.
   */
  async requestPayout(
    userId: string,
    dto: RequestPayoutDto,
  ): Promise<CreatorPayoutRequestDto> {
    const wallet = await this.prisma.creatorWallet.findUnique({
      where: { userId },
    });

    if (!wallet) {
      throw new BadRequestException('Creator wallet not found.');
    }

    if (wallet.balancePaise < dto.amountPaise) {
      throw new BadRequestException(
        `Insufficient withdrawable balance. Available: ₹${(wallet.balancePaise / 100).toFixed(2)}, Requested: ₹${(dto.amountPaise / 100).toFixed(2)}`,
      );
    }

    if (dto.amountPaise < 50000) {
      throw new BadRequestException('Minimum withdrawal amount is ₹500 (50,000 paise).');
    }

    // Check if there is an existing pending payout
    const existingPending = await this.prisma.creatorPayoutRequest.findFirst({
      where: {
        userId,
        status: { in: [PayoutStatus.PENDING, PayoutStatus.PROCESSING] },
      },
    });

    if (existingPending) {
      throw new BadRequestException(
        'You already have a payout request under review. Please wait until it is processed.',
      );
    }

    // Atomically debit wallet and record payout request
    const payout = await this.prisma.$transaction(async (tx) => {
      await tx.creatorWallet.update({
        where: { userId },
        data: {
          balancePaise: { decrement: dto.amountPaise },
          totalWithdrawnPaise: { increment: dto.amountPaise },
          upiId: dto.upiId,
          accountHolderName: dto.accountHolderName,
        },
      });

      return tx.creatorPayoutRequest.create({
        data: {
          walletId: wallet.id,
          userId,
          amountPaise: dto.amountPaise,
          upiId: dto.upiId,
          accountHolderName: dto.accountHolderName,
          status: PayoutStatus.PENDING,
        },
      });
    });

    this.logger.log(
      `[PAYOUT_REQUESTED] User ${userId} requested payout of ₹${(dto.amountPaise / 100).toFixed(2)} via UPI ${dto.upiId}`,
    );

    return {
      id: payout.id,
      amountPaise: payout.amountPaise,
      amountInr: payout.amountPaise / 100,
      upiId: payout.upiId,
      accountHolderName: payout.accountHolderName,
      status: payout.status as PayoutStatus,
      adminNote: payout.adminNote,
      createdAt: payout.createdAt.toISOString(),
      processedAt: payout.processedAt?.toISOString() || null,
      referenceNumber: payout.referenceNumber,
    };
  }

  /**
   * Retrieves payout request history for a creator.
   */
  async getPayoutHistory(userId: string): Promise<CreatorPayoutRequestDto[]> {
    const payouts = await this.prisma.creatorPayoutRequest.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return payouts.map((p) => ({
      id: p.id,
      amountPaise: p.amountPaise,
      amountInr: p.amountPaise / 100,
      upiId: p.upiId,
      accountHolderName: p.accountHolderName,
      status: p.status as PayoutStatus,
      adminNote: p.adminNote,
      createdAt: p.createdAt.toISOString(),
      processedAt: p.processedAt?.toISOString() || null,
      referenceNumber: p.referenceNumber,
    }));
  }

  /**
   * Retrieves the gifts received by the user.
   */
  async getGiftsReceived(userId: string, limit = 20) {
    const gifts = await this.prisma.virtualGiftTransaction.findMany({
      where: { receiverUserId: userId },
      include: {
        senderUser: {
          include: {
            profile: {
              select: {
                displayName: true,
                photos: {
                  where: { status: 'APPROVED' },
                  orderBy: { position: 'asc' },
                  take: 1,
                  select: { thumbnailKey: true, objectKey: true },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return gifts.map((g) => ({
      id: g.id,
      giftType: g.giftType,
      senderDisplayName: g.senderUser?.profile?.displayName || 'User',
      senderAvatarUrl:
        g.senderUser?.profile?.photos[0]?.thumbnailKey ||
        g.senderUser?.profile?.photos[0]?.objectKey ||
        null,
      creatorEarningInr: g.creatorEarningPaise / 100,
      createdAt: g.createdAt.toISOString(),
    }));
  }
}
