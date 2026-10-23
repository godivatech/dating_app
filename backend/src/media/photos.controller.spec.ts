import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PhotosController } from './photos.controller';
import { PhotosService } from './services/photos.service';
import { RolesGuard } from '../safety/guards/roles.guard';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '../../../shared/src/types';
import { UserStatus, PhotoStatus } from '@prisma/client';
import { ROLES_KEY } from '../safety/decorators/roles.decorator';

describe('PhotosController & Moderation RBAC (SEC-02)', () => {
  let controller: PhotosController;
  let rolesGuard: RolesGuard;
  let reflector: Reflector;
  let mockPhotosService: any;
  let mockPrisma: any;

  beforeEach(async () => {
    mockPhotosService = {
      moderatePhoto: jest.fn().mockImplementation((photoId, dto) =>
        Promise.resolve({
          id: photoId,
          profileId: 'prof-123',
          url: 'https://cdn.example.com/photo.jpg',
          status: dto.status,
          position: 0,
          isPrimary: true,
          uploadedAt: new Date().toISOString(),
        }),
      ),
    };

    mockPrisma = {
      user: {
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PhotosController],
      providers: [
        Reflector,
        RolesGuard,
        {
          provide: PhotosService,
          useValue: mockPhotosService,
        },
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    controller = module.get<PhotosController>(PhotosController);
    rolesGuard = module.get<RolesGuard>(RolesGuard);
    reflector = module.get<Reflector>(Reflector);
  });

  describe('Route metadata check', () => {
    it('moderatePhoto method must have RolesGuard and require ADMIN / MODERATOR roles', () => {
      const targetHandler = controller.moderatePhoto;
      const roles = reflector.get<UserRole[]>(ROLES_KEY, targetHandler);

      expect(roles).toBeDefined();
      expect(roles).toContain(UserRole.ADMIN);
      expect(roles).toContain(UserRole.MODERATOR);
      expect(roles).not.toContain(UserRole.USER);
    });
  });

  describe('RolesGuard execution on photo moderation', () => {
    const createMockExecutionContext = (userId: string): ExecutionContext => {
      const handler = controller.moderatePhoto;
      return {
        getHandler: () => handler,
        getClass: () => PhotosController,
        switchToHttp: () => ({
          getRequest: () => ({
            user: { userId },
          }),
        }),
      } as unknown as ExecutionContext;
    };

    it('should deny an ordinary user (role: USER) from moderating photos', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        role: UserRole.USER,
        status: UserStatus.ACTIVE,
      });

      const context = createMockExecutionContext('ordinary-user-id');

      await expect(rolesGuard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(rolesGuard.canActivate(context)).rejects.toThrow(
        'Access denied. Insufficient role permissions.',
      );
    });

    it('should allow an administrator (role: ADMIN) to moderate photos', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
      });

      const context = createMockExecutionContext('admin-user-id');
      const canActivate = await rolesGuard.canActivate(context);

      expect(canActivate).toBe(true);
    });

    it('should allow a moderator (role: MODERATOR) to moderate photos', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        role: UserRole.MODERATOR,
        status: UserStatus.ACTIVE,
      });

      const context = createMockExecutionContext('moderator-user-id');
      const canActivate = await rolesGuard.canActivate(context);

      expect(canActivate).toBe(true);
    });

    it('should deny unauthenticated requests missing user context', async () => {
      const unauthContext = {
        getHandler: () => controller.moderatePhoto,
        getClass: () => PhotosController,
        switchToHttp: () => ({
          getRequest: () => ({
            user: null,
          }),
        }),
      } as unknown as ExecutionContext;

      await expect(rolesGuard.canActivate(unauthContext)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should deny users whose account status is not ACTIVE', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        role: UserRole.ADMIN,
        status: UserStatus.BANNED,
      });

      const context = createMockExecutionContext('banned-admin-id');

      await expect(rolesGuard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(rolesGuard.canActivate(context)).rejects.toThrow(
        'Account is not active.',
      );
    });
  });

  describe('controller.moderatePhoto execution when authorized', () => {
    it('should successfully moderate photo and return updated SafeProfilePhoto', async () => {
      const result = await controller.moderatePhoto('photo-123', {
        status: PhotoStatus.APPROVED,
      });

      expect(result.id).toBe('photo-123');
      expect(result.status).toBe(PhotoStatus.APPROVED);
      expect(mockPhotosService.moderatePhoto).toHaveBeenCalledWith(
        'photo-123',
        { status: PhotoStatus.APPROVED },
      );
    });
  });
});
