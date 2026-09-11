import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SubscriptionService } from './services/subscription.service';
import { PurchaseService } from './services/purchase.service';
import { VerifyPurchaseDto } from './dto/verify-purchase.dto';
import { RestorePurchasesDto } from './dto/restore-purchases.dto';
import { CreditService } from './services/credit.service';
import {
  SafeSubscriptionProduct,
  BillingStatusResponse,
  VerifyPurchaseResponse,
  RestorePurchasesResponse,
  SafeUserSubscription,
  UserCreditBalanceDto,
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
}
