import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NotificationsService } from './services/notifications.service';
import { NotificationsQueryDto } from './dto/notifications-query.dto';
import { RegisterDeviceDto } from './dto/register-device.dto';
import {
  NotificationsListResponse,
  SafeNotification,
  UnreadCountResponse,
  DeviceRegistrationResponse,
} from '../../../shared/src/types';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  /**
   * Retrieves paginated notifications for the authenticated user.
   */
  @Get()
  async listNotifications(
    @Req() req: any,
    @Query() query: NotificationsQueryDto,
  ): Promise<NotificationsListResponse> {
    const userId = req.user.userId;
    return this.notificationsService.listNotifications(userId, query);
  }

  /**
   * Returns current unread notification count.
   */
  @Get('unread-count')
  async getUnreadCount(@Req() req: any): Promise<UnreadCountResponse> {
    const userId = req.user.userId;
    return this.notificationsService.getUnreadCount(userId);
  }

  /**
   * Marks a specific notification as read.
   */
  @Patch(':id/read')
  async markAsRead(
    @Req() req: any,
    @Param('id') id: string,
  ): Promise<SafeNotification> {
    const userId = req.user.userId;
    return this.notificationsService.markAsRead(userId, id);
  }

  /**
   * Marks all notifications as read for the authenticated user.
   */
  @Post('read-all')
  @HttpCode(HttpStatus.OK)
  async markAllAsRead(@Req() req: any): Promise<{ updatedCount: number }> {
    const userId = req.user.userId;
    return this.notificationsService.markAllAsRead(userId);
  }

  /**
   * Registers a mobile push device token for the user.
   */
  @Post('device-token')
  @HttpCode(HttpStatus.OK)
  async registerDevice(
    @Req() req: any,
    @Body() dto: RegisterDeviceDto,
  ): Promise<DeviceRegistrationResponse> {
    const userId = req.user.userId;
    return this.notificationsService.registerDevice(userId, dto);
  }

  /**
   * Deactivates a device push token upon logout.
   */
  @Delete('device-token')
  @HttpCode(HttpStatus.OK)
  async unregisterDevice(
    @Req() req: any,
    @Body('token') token: string,
  ): Promise<{ success: boolean }> {
    const userId = req.user.userId;
    return this.notificationsService.unregisterDevice(userId, token);
  }
}
