import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../safety/guards/roles.guard';
import { Roles } from '../safety/decorators/roles.decorator';
import { AdminService } from './admin.service';
import { AdminUsersQueryDto } from './dto/admin-users-query.dto';
import { AdminDisciplineDto } from './dto/admin-discipline.dto';
import { AdminReviewPhotoDto } from './dto/admin-review-photo.dto';
import {
  UserRole,
  AdminAnalyticsOverviewDto,
  AdminRevenueOverviewDto,
  AdminUsersListResponse,
  AdminUserDetailDto,
  AdminPhotoQueueItemDto,
} from '../../../shared/src/types';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.MODERATOR)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  /**
   * Retrieves high-level business, user, and revenue KPIs.
   */
  @Get('analytics/overview')
  async getAnalyticsOverview(): Promise<AdminAnalyticsOverviewDto> {
    return this.adminService.getAnalyticsOverview();
  }

  /**
   * Retrieves comprehensive monetization metrics, MRR, tier performance, and store products.
   */
  @Get('revenue/overview')
  async getRevenueOverview(): Promise<AdminRevenueOverviewDto> {
    return this.adminService.getRevenueOverview();
  }

  /**
   * Searches and filters users with pagination.
   */
  @Get('users')
  async searchUsers(
    @Query() query: AdminUsersQueryDto,
  ): Promise<AdminUsersListResponse> {
    return this.adminService.searchUsers(query);
  }

  /**
   * Retrieves comprehensive user dossier (profile, strikes, billing, photos).
   */
  @Get('users/:id')
  async getUserDetail(@Param('id') id: string): Promise<AdminUserDetailDto> {
    return this.adminService.getUserDetail(id);
  }

  /**
   * Applies administrative discipline (warn, mute, shadowban, ban, unban, reset strikes).
   */
  @Patch('users/:id/discipline')
  @HttpCode(HttpStatus.OK)
  async updateUserDiscipline(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: AdminDisciplineDto,
  ): Promise<{ success: boolean; message: string }> {
    const adminId = req.user.userId;
    return this.adminService.updateUserDiscipline(id, dto, adminId);
  }

  /**
   * Authoritatively updates user system role (USER, MODERATOR, ADMIN).
   */
  @Patch('users/:id/role')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.ADMIN)
  async updateUserRole(
    @Req() req: any,
    @Param('id') id: string,
    @Body('role') role: UserRole,
  ): Promise<{ success: boolean; userId: string; role: string }> {
    const adminId = req.user.userId;
    return this.adminService.updateUserRole(id, role, adminId);
  }

  /**
   * Retrieves photos awaiting moderation.
   */
  @Get('photos/pending')
  async getPendingPhotos(): Promise<AdminPhotoQueueItemDto[]> {
    return this.adminService.getPendingPhotosQueue();
  }

  /**
   * Approves or rejects a photo.
   */
  @Patch('photos/:id/review')
  @HttpCode(HttpStatus.OK)
  async reviewPhoto(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: AdminReviewPhotoDto,
  ): Promise<{ success: boolean; photoId: string; status: string }> {
    const adminId = req.user.userId;
    return this.adminService.reviewPhoto(id, dto, adminId);
  }

  /**
   * Retrieves recent customer transactions and purchases.
   */
  @Get('transactions')
  async getTransactions(): Promise<any[]> {
    return this.adminService.getTransactions();
  }
}
