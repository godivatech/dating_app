import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Req,
  Query,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SubscriptionService } from './services/subscription.service';
import { PurchaseService } from './services/purchase.service';
import { VerifyPurchaseDto } from './dto/verify-purchase.dto';
import { RestorePurchasesDto } from './dto/restore-purchases.dto';
import { CreditService } from './services/credit.service';
import { CoinTransactionType } from '@prisma/client';
import { SpendCoinsDto } from './dto/spend-coins.dto';
import {
  SafeSubscriptionProduct,
  BillingStatusResponse,
  VerifyPurchaseResponse,
  RestorePurchasesResponse,
  SafeUserSubscription,
  UserCreditBalanceDto,
  SpendCoinsResponse,
  SafeCoinTransaction,
} from '../../../shared/src/types';

@Controller('billing')
@UseGuards(JwtAuthGuard)
export class BillingController {
  constructor(
    private readonly subscriptionService: SubscriptionService,
    private readonly purchaseService: PurchaseService,
    private readonly creditService: CreditService,
  ) {}

  /**
   * Retrieves active subscription products and localized INR pricing.
   */
  @Get('products')
  async getProducts(): Promise<SafeSubscriptionProduct[]> {
    return this.subscriptionService.getAvailableProducts();
  }

  /**
   * Retrieves current user's billing status, active subscription, and entitlements.
   */
  @Get('status')
  async getStatus(@Req() req: any): Promise<BillingStatusResponse> {
    const userId = req.user.userId;
    return this.subscriptionService.getBillingStatus(userId);
  }

  /**
   * Retrieves current user's consumable credit balance (notes, boosts, call passes).
   */
  @Get('credits')
  async getCredits(@Req() req: any): Promise<UserCreditBalanceDto> {
    const userId = req.user.userId;
    return this.creditService.getUserCreditDto(userId);
  }

  /**
   * Verifies an In-App Purchase receipt with replay protection.
   */
  @Post('verify-purchase')
  @HttpCode(HttpStatus.OK)
  async verifyPurchase(
    @Req() req: any,
    @Body() dto: VerifyPurchaseDto,
  ): Promise<VerifyPurchaseResponse> {
    const userId = req.user.userId;
    return this.purchaseService.verifyPurchase(userId, dto);
  }

  /**
   * Restores previous purchases for the requesting user.
   */
  @Post('restore-purchases')
  @HttpCode(HttpStatus.OK)
  async restorePurchases(
    @Req() req: any,
    @Body() dto: RestorePurchasesDto,
  ): Promise<RestorePurchasesResponse> {
    const userId = req.user.userId;
    return this.purchaseService.restorePurchases(userId, dto);
  }

  /**
   * Cancels subscription auto-renewal.
   */
  @Post('cancel')
  @HttpCode(HttpStatus.OK)
  async cancelSubscription(@Req() req: any): Promise<SafeUserSubscription> {
    const userId = req.user.userId;
    return this.subscriptionService.cancelSubscription(userId);
  }

  /**
   * Spends user coins for a specified action/capability.
   */
  @Post('coins/spend')
  @HttpCode(HttpStatus.OK)
  async spendCoins(
    @Req() req: any,
    @Body() dto: SpendCoinsDto,
  ): Promise<SpendCoinsResponse> {
    const userId = req.user.userId;
    if (!dto.amount || dto.amount <= 0) {
      throw new BadRequestException('Amount must be greater than 0.');
    }

    let txType: CoinTransactionType;
    switch (dto.reason) {
      case 'DIRECT_NOTE':
        txType = CoinTransactionType.SPEND_DIRECT_NOTE;
        break;
      case 'BOOST':
        txType = CoinTransactionType.SPEND_PROFILE_BOOST;
        break;
      case 'CALL':
        txType = CoinTransactionType.SPEND_CALL_MINUTES;
        break;
      case 'REWIND':
        txType = CoinTransactionType.SPEND_REWIND;
        break;
      case 'UNBLUR':
        txType = CoinTransactionType.SPEND_UNBLUR;
        break;
      default:
        txType = CoinTransactionType.SPEND_DIRECT_NOTE;
    }

    const success = await this.creditService.deductCoins(
      userId,
      dto.amount,
      txType,
      dto.description,
      dto.referenceId,
    );

    if (!success) {
      throw new BadRequestException('Insufficient coins balance.');
    }

    const balance = await this.creditService.getOrCreateBalance(userId);

    return {
      success: true,
      coinsDeducted: dto.amount,
      remainingCoins: balance.coins,
      message: `Successfully spent ${dto.amount} coins for ${dto.reason}.`,
    };
  }

  /**
   * Retrieves current user's coin transaction history.
   */
  @Get('coins/history')
  async getCoinHistory(
    @Req() req: any,
    @Query('limit') limit?: string,
  ): Promise<SafeCoinTransaction[]> {
    const userId = req.user.userId;
    const take = limit ? Math.min(Math.max(parseInt(limit, 10) || 30, 1), 100) : 30;
    const history = await this.creditService.getCoinHistory(userId, take);
    return history.map((h) => ({
      id: h.id,
      userId: h.userId,
      amount: h.amount,
      balanceAfter: h.balanceAfter,
      type: h.type as any,
      description: h.description,
      referenceId: h.referenceId,
      createdAt: h.createdAt.toISOString(),
    }));
  }
}
