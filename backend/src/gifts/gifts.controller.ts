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
import { GiftsService } from './services/gifts.service';
import { SendGiftDto } from './dto/send-gift.dto';
import { RequestPayoutDto } from './dto/payout-request.dto';
import {
  GiftCatalogItem,
  SendGiftResponseDto,
  CreatorWalletDto,
  CreatorPayoutRequestDto,
} from '../../../shared/src/types';

@Controller('gifts')
@UseGuards(JwtAuthGuard)
export class GiftsController {
  constructor(private readonly giftsService: GiftsService) {}

  /**
   * Returns available virtual gifts, coin pricing, and creator earnings.
   */
  @Get('catalog')
  getCatalog(): GiftCatalogItem[] {
    return this.giftsService.getCatalog();
  }

  /**
   * Sends a virtual gift to a match or call partner.
   */
  @Post('send')
  @HttpCode(HttpStatus.OK)
  async sendGift(
    @Req() req: any,
    @Body() dto: SendGiftDto,
  ): Promise<SendGiftResponseDto> {
    const userId = req.user.userId;
    return this.giftsService.sendGift(userId, dto);
  }

  /**
   * Returns the authenticated user's Creator Wallet balance & stats.
   */
  @Get('wallet')
  async getWallet(@Req() req: any): Promise<CreatorWalletDto> {
    const userId = req.user.userId;
    return this.giftsService.getCreatorWallet(userId);
  }

  /**
   * Initiates a withdrawal request to transfer creator balance to UPI.
   */
  @Post('payout')
  @HttpCode(HttpStatus.CREATED)
  async requestPayout(
    @Req() req: any,
    @Body() dto: RequestPayoutDto,
  ): Promise<CreatorPayoutRequestDto> {
    const userId = req.user.userId;
    return this.giftsService.requestPayout(userId, dto);
  }

  /**
   * Returns payout request history.
   */
  @Get('payouts')
  async getPayoutHistory(
    @Req() req: any,
  ): Promise<CreatorPayoutRequestDto[]> {
    const userId = req.user.userId;
    return this.giftsService.getPayoutHistory(userId);
  }

  /**
   * Returns list of gifts received by the user.
   */
  @Get('received')
  async getGiftsReceived(@Req() req: any) {
    const userId = req.user.userId;
    return this.giftsService.getGiftsReceived(userId);
  }
}
