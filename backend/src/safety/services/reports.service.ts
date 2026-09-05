import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { BlocksService } from './blocks.service';
import { CreateReportDto } from '../dto/create-report.dto';
import {
  SafeReport,
  ReportTargetType,
  ReportReason,
  ReportStatus,
} from '../../../../shared/src/types';
import { ReportStatus as PrismaReportStatus } from '@prisma/client';

export const REPORT_RATE_WINDOW_SECONDS = 60;
export const MAX_REPORTS_PER_WINDOW = 10;

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly blocksService: BlocksService,
  ) {}

  /**
   * Submits a safety report against a user, profile, photo, or message.
   * Captures immutable evidence snapshots and optionally executes an automatic block.
   */
  async createReport(
    reporterUserId: string,
    dto: CreateReportDto,
  ): Promise<SafeReport> {
    if (reporterUserId === dto.targetUserId) {
      throw new BadRequestException('You cannot report yourself.');
    }

    // 1. Anti-Abuse Rate Limiting
    const rateKey = `safety:report-rate:${reporterUserId}`;
    const rate = await this.redisService.incrementWithWindow(
      rateKey,
      REPORT_RATE_WINDOW_SECONDS,
    );
    if (rate.current > MAX_REPORTS_PER_WINDOW) {
      throw new BadRequestException(
        'Too many reports submitted. Please wait before submitting again.',
      );
    }

    // 2. Validate Reported User
    const reportedUser = await this.prisma.user.findUnique({
      where: { id: dto.targetUserId },
    });

    if (!reportedUser) {
      throw new NotFoundException('Reported user not found.');
    }

    // 3. Capture Immutable Evidence Snapshot
    let evidenceSnapshot: any = null;
    if (dto.targetType === ReportTargetType.MESSAGE) {
      const msg = await this.prisma.message.findUnique({
        where: { id: dto.targetId },
      });
      if (msg) {
        evidenceSnapshot = {
          messageId: msg.id,
          bodySnippet: msg.body.slice(0, 200),
          sequence: msg.sequence,
          senderUserId: msg.senderUserId,
          messageCreatedAt: msg.createdAt,
        };
      }
    } else if (dto.targetType === ReportTargetType.PHOTO) {
      const photo = await this.prisma.profilePhoto.findUnique({
        where: { id: dto.targetId },
      });
      if (photo) {
        evidenceSnapshot = {
          photoId: photo.id,
          objectKey: photo.objectKey,
          position: photo.position,
          mimeType: photo.mimeType,
        };
      }
    } else if (dto.targetType === ReportTargetType.PROFILE) {
      const profile = await this.prisma.datingProfile.findUnique({
        where: { id: dto.targetId },
      });
      if (profile) {
        evidenceSnapshot = {
          profileId: profile.id,
          displayName: profile.displayName,
          bio: profile.bio,
          city: profile.locationCity,
        };
      }
    }

    // 4. Create Report Record
    const report = await this.prisma.report.create({
      data: {
        reporterUserId,
        targetUserId: dto.targetUserId,
        targetType: dto.targetType,
        targetId: dto.targetId,
        reason: dto.reason,
        details: dto.description,
        snapshotJson: evidenceSnapshot || undefined,
        status: PrismaReportStatus.OPEN,
      },
    });

    this.logger.log(
      `[USER_REPORTED] Report ${report.id} created by ${reporterUserId} on ${dto.targetType} ${dto.targetId} (Reason: ${dto.reason})`,
    );

    // 5. Execute Auto-Block if requested
    if (dto.autoBlock) {
      try {
        await this.blocksService.blockUser(
          reporterUserId,
          dto.targetUserId,
          `Auto-blocked upon reporting: ${dto.reason}`,
        );
      } catch {
        // Non-blocking auto-block fallback
      }
    }

    return {
      id: report.id,
      reportedUserId: report.targetUserId,
      targetType: report.targetType as ReportTargetType,
      targetId: report.targetId,
      reason: report.reason as ReportReason,
      description: report.details || undefined,
      status: report.status as ReportStatus,
      createdAt: (report.createdAt
        ? new Date(report.createdAt)
        : new Date()
      ).toISOString(),
    };
  }
}
