import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DiscoveryPaginationService } from '../../discovery/services/discovery-pagination.service';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { ModeratorActionDto } from '../dto/moderator-action.dto';
import { ReportsQueryDto } from '../dto/reports-query.dto';
import { AuditLogsQueryDto } from '../dto/audit-logs-query.dto';
import {
  ModerationAuditLogResponse,
  AuditLogsListResponse,
  ReportsListResponse,
  SafeReport,
  ReportTargetType,
  ReportReason,
  ReportStatus,
  ModerationActionType,
  NotificationType,
} from '../../../../shared/src/types';
import {
  UserStatus,
  ProfileVisibility,
  ProfileStatus,
  PhotoStatus,
  ReportStatus as PrismaReportStatus,
  ModerationActionType as PrismaActionType,
} from '@prisma/client';

@Injectable()
export class ModerationService {
  private readonly logger = new Logger(ModerationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly paginationService: DiscoveryPaginationService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Atomically executes a moderation decision and produces an immutable audit record.
   */
  async applyModeratorAction(
    moderatorUserId: string,
    dto: ModeratorActionDto,
  ): Promise<ModerationAuditLogResponse> {
    const targetUser = await this.prisma.user.findUnique({
      where: { id: dto.targetUserId },
      include: { profile: { include: { photos: true } } },
    });

    if (!targetUser) {
      throw new NotFoundException('Target user not found.');
    }

    const auditLog = await this.prisma.$transaction(async (tx) => {
      // 1. Apply Action State Changes
      switch (dto.actionType) {
        case ModerationActionType.SUSPEND_ACCOUNT:
          await tx.user.update({
            where: { id: dto.targetUserId },
            data: { status: UserStatus.SUSPENDED },
          });
          await tx.authSession.updateMany({
            where: { userId: dto.targetUserId, revokedAt: null },
            data: { revokedAt: new Date() },
          });
          break;

        case ModerationActionType.BAN_ACCOUNT:
          await tx.user.update({
            where: { id: dto.targetUserId },
            data: { status: UserStatus.BANNED },
          });
          await tx.authSession.updateMany({
            where: { userId: dto.targetUserId, revokedAt: null },
            data: { revokedAt: new Date() },
          });
          break;

        case ModerationActionType.RESTORE_ACCOUNT:
          await tx.user.update({
            where: { id: dto.targetUserId },
            data: { status: UserStatus.ACTIVE },
          });
          // Note: Profile visibility remains unchanged or HIDDEN for fail-closed safety
          break;

        case ModerationActionType.HIDE_PROFILE:
          if (targetUser.profile) {
            await tx.datingProfile.update({
              where: { userId: dto.targetUserId },
              data: { visibility: ProfileVisibility.HIDDEN },
            });
          }
          break;

        case ModerationActionType.UNHIDE_PROFILE:
          if (targetUser.profile) {
            await tx.datingProfile.update({
              where: { userId: dto.targetUserId },
              data: { visibility: ProfileVisibility.VISIBLE },
            });
          }
          break;

        case ModerationActionType.REJECT_PHOTO: {
          const photoId = dto.photoId;
          if (!photoId) {
            throw new BadRequestException(
              'photoId is required for REJECT_PHOTO.',
            );
          }
          await tx.profilePhoto.update({
            where: { id: photoId },
            data: {
              status: PhotoStatus.REJECTED,
              rejectionReason: dto.reason,
            },
          });

          // Re-evaluate approved photos ordering and profile readiness
          const remainingApproved = await tx.profilePhoto.findMany({
            where: {
              profileId: targetUser.profile?.id,
              status: PhotoStatus.APPROVED,
            },
            orderBy: { position: 'asc' },
          });

          for (let i = 0; i < remainingApproved.length; i++) {
            await tx.profilePhoto.update({
              where: { id: remainingApproved[i].id },
              data: { position: i },
            });
          }

          if (remainingApproved.length === 0 && targetUser.profile) {
            await tx.datingProfile.update({
              where: { id: targetUser.profile.id },
              data: { status: ProfileStatus.IN_PROGRESS },
            });
          }
          break;
        }

        case ModerationActionType.DISMISS_REPORT:
        case ModerationActionType.WARN_USER:
        default:
          break;
      }

      // 2. Update Associated Report if provided
      if (dto.reportId) {
        await tx.report.update({
          where: { id: dto.reportId },
          data: {
            status:
              dto.actionType === ModerationActionType.DISMISS_REPORT
                ? PrismaReportStatus.DISMISSED
                : PrismaReportStatus.ACTIONED,
            reviewedByUserId: moderatorUserId,
            reviewedAt: new Date(),
            resolutionNotes: dto.reason,
          },
        });
      }

      // 3. Write Immutable Audit Record
      const log = await tx.moderationAuditLog.create({
        data: {
          moderatorUserId,
          targetUserId: dto.targetUserId,
          actionType: dto.actionType,
          reason: dto.reason,
          reportId: dto.reportId,
          metadata: dto.photoId ? { photoId: dto.photoId } : undefined,
        },
      });

      return log;
    });

    this.logger.log(
      `[MODERATION_ACTION_APPLIED] Moderator ${moderatorUserId} applied ${dto.actionType} on user ${dto.targetUserId} (Audit ID: ${auditLog.id})`,
    );

    // 4. Decoupled Post-Transaction Safety Notification Dispatch
    try {
      let notifTitle = 'Safety Update';
      let notifBody =
        'Your account status has been updated by our safety team.';

      if (dto.actionType === ModerationActionType.WARN_USER) {
        notifTitle = 'Community Guidelines Warning ⚠️';
        notifBody = `Warning: ${dto.reason}`;
      } else if (dto.actionType === ModerationActionType.RESTORE_ACCOUNT) {
        notifTitle = 'Account Restored ✅';
        notifBody = 'Your account access has been fully restored.';
      } else if (dto.actionType === ModerationActionType.REJECT_PHOTO) {
        notifTitle = 'Photo Rejected ⚠️';
        notifBody =
          'A photo on your profile did not meet our guidelines and was removed.';
      }

      if (
        dto.actionType === ModerationActionType.WARN_USER ||
        dto.actionType === ModerationActionType.RESTORE_ACCOUNT ||
        dto.actionType === ModerationActionType.REJECT_PHOTO
      ) {
        await this.notificationsService.createNotification(
          dto.targetUserId,
          {
            type: NotificationType.SAFETY_UPDATE,
            referenceId: auditLog.id,
            title: notifTitle,
            body: notifBody,
            metadata: { actionType: dto.actionType, reason: dto.reason },
          },
          `safety:${auditLog.id}:user:${dto.targetUserId}`,
        );
      }
    } catch (notifErr: any) {
      this.logger.warn(
        `[NOTIF_SAFETY_FAILED] Failed to dispatch safety notification: ${notifErr.message}`,
      );
    }

    return {
      id: auditLog.id,
      moderatorUserId: auditLog.moderatorUserId,
      targetUserId: auditLog.targetUserId,
      actionType: auditLog.actionType as ModerationActionType,
      reason: auditLog.reason,
      reportId: auditLog.reportId || undefined,
      metadata: auditLog.metadata,
      createdAt: (auditLog.createdAt
        ? new Date(auditLog.createdAt)
        : new Date()
      ).toISOString(),
    };
  }

  /**
   * Retrieves paginated reports for moderation review.
   */
  async listReports(query: ReportsQueryDto): Promise<ReportsListResponse> {
    const limit = query.limit || 20;
    const { offset } = this.paginationService.decodeCursor(query.cursor);

    const where: any = {};
    if (query.status) where.status = query.status as PrismaReportStatus;
    if (query.reason) where.reason = query.reason;

    const reports = await this.prisma.report.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit + 1,
    });

    const hasMore = reports.length > limit;
    const items = hasMore ? reports.slice(0, limit) : reports;
    const nextCursor = hasMore
      ? this.paginationService.createCursor(offset + limit)
      : null;

    const mapped: SafeReport[] = items.map((r) => ({
      id: r.id,
      reporterUserId: r.reporterUserId,
      reportedUserId: r.targetUserId,
      targetType: r.targetType as ReportTargetType,
      targetId: r.targetId,
      reason: r.reason as ReportReason,
      description: r.details || undefined,
      status: r.status as ReportStatus,
      createdAt: (r.createdAt
        ? new Date(r.createdAt)
        : new Date()
      ).toISOString(),
    }));

    return {
      reports: mapped,
      nextCursor,
      hasMore,
    };
  }

  /**
   * Retrieves paginated immutable moderation audit logs.
   */
  async listAuditLogs(
    query: AuditLogsQueryDto,
  ): Promise<AuditLogsListResponse> {
    const limit = query.limit || 20;
    const { offset } = this.paginationService.decodeCursor(query.cursor);

    const where: any = {};
    if (query.targetUserId) where.targetUserId = query.targetUserId;
    if (query.actionType)
      where.actionType = query.actionType as PrismaActionType;

    const logs = await this.prisma.moderationAuditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit + 1,
    });

    const hasMore = logs.length > limit;
    const items = hasMore ? logs.slice(0, limit) : logs;
    const nextCursor = hasMore
      ? this.paginationService.createCursor(offset + limit)
      : null;

    const mapped: ModerationAuditLogResponse[] = items.map((l) => ({
      id: l.id,
      moderatorUserId: l.moderatorUserId,
      targetUserId: l.targetUserId,
      actionType: l.actionType as ModerationActionType,
      reason: l.reason,
      reportId: l.reportId || undefined,
      metadata: l.metadata,
      createdAt: (l.createdAt
        ? new Date(l.createdAt)
        : new Date()
      ).toISOString(),
    }));

    return {
      logs: mapped,
      nextCursor,
      hasMore,
    };
  }
}
