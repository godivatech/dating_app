import { Test, TestingModule } from '@nestjs/testing';
import { ReportsService } from './reports.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { BlocksService } from './blocks.service';
import { BadRequestException } from '@nestjs/common';
import {
  ReportTargetType,
  ReportReason,
  ReportStatus,
} from '../../../../shared/src/types';

describe('ReportsService', () => {
  let service: ReportsService;
  let prisma: any;
  let redisService: any;
  let blocksService: any;

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
      },
      message: {
        findUnique: jest.fn(),
      },
      profilePhoto: {
        findUnique: jest.fn(),
      },
      datingProfile: {
        findUnique: jest.fn(),
      },
      report: {
        create: jest.fn(),
      },
    };

    redisService = {
      incrementWithWindow: jest.fn().mockResolvedValue({ current: 1, ttl: 60 }),
    };

    blocksService = {
      blockUser: jest.fn().mockResolvedValue({ id: 'block-1' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: redisService },
        { provide: BlocksService, useValue: blocksService },
      ],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
  });

  describe('createReport', () => {
    it('should reject self-reporting', async () => {
      await expect(
        service.createReport('user-1', {
          targetUserId: 'user-1',
          targetType: ReportTargetType.USER,
          targetId: 'user-1',
          reason: ReportReason.HARASSMENT,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject when rate limit exceeded', async () => {
      redisService.incrementWithWindow.mockResolvedValue({
        current: 15,
        ttl: 60,
      });

      await expect(
        service.createReport('user-1', {
          targetUserId: 'user-2',
          targetType: ReportTargetType.USER,
          targetId: 'user-2',
          reason: ReportReason.SPAM,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create report with evidence snapshot and auto-block if requested', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'user-2' });
      prisma.message.findUnique.mockResolvedValue({
        id: 'msg-1',
        body: 'Inappropriate text content',
        sequence: 4,
        senderUserId: 'user-2',
        createdAt: new Date(),
      });
      prisma.report.create.mockResolvedValue({
        id: 'report-1',
        reporterUserId: 'user-1',
        reportedUserId: 'user-2',
        targetType: ReportTargetType.MESSAGE,
        targetId: 'msg-1',
        reason: ReportReason.HARASSMENT,
        description: 'Offensive language',
        status: ReportStatus.OPEN,
        createdAt: new Date(),
      });

      const result = await service.createReport('user-1', {
        targetUserId: 'user-2',
        targetType: ReportTargetType.MESSAGE,
        targetId: 'msg-1',
        reason: ReportReason.HARASSMENT,
        description: 'Offensive language',
        autoBlock: true,
      });

      expect(result.id).toBe('report-1');
      expect(result.targetType).toBe(ReportTargetType.MESSAGE);
      expect(blocksService.blockUser).toHaveBeenCalledWith(
        'user-1',
        'user-2',
        expect.stringContaining('Auto-blocked upon reporting'),
      );
    });
  });
});
