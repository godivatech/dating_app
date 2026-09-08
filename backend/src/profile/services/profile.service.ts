import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Inject,
  Logger,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ProfileCompletionService } from './profile-completion.service';
import { InterestsService } from './interests.service';
import { validateDobEligibility, calculateAge } from '../utils/age.util';
import type { StorageService } from '../../media/storage/storage.interface';
import { STORAGE_SERVICE } from '../../media/storage/storage.interface';
import { SafetyPolicyService } from '../../safety/services/safety-policy.service';
import { ContentFilterService } from '../../safety/services/content-filter.service';
import {
  ProfileVisibility,
  ProfileStatus,
  PreferredGenderMode,
  Gender,
  PhotoStatus,
  MatchStatus,
} from '@prisma/client';
import { UpdateIdentityDto } from '../dto/update-identity.dto';
import { UpdatePreferencesDto } from '../dto/update-preferences.dto';
import { UpdateInterestsDto } from '../dto/update-interests.dto';
import { UpdateAboutLocationDto } from '../dto/update-about-location.dto';
import {
  SafeDatingProfile,
  SafeProfilePhoto,
  PhotoStatus as SharedPhotoStatus,
  ProfileCompletionResult,
  ViewableProfileDto,
} from '../../../../shared/src/types';
import {
  calculateRelativeDistance,
  isValidCoordinate,
} from '../../discovery/utils/geo-distance.util';

@Injectable()
export class ProfileService {
  private readonly logger = new Logger(ProfileService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly completionService: ProfileCompletionService,
    private readonly interestsService: InterestsService,
    @Inject(STORAGE_SERVICE)
    private readonly storageService: StorageService,
    @Inject(forwardRef(() => SafetyPolicyService))
    private readonly safetyPolicyService: SafetyPolicyService,
    @Inject(forwardRef(() => ContentFilterService))
    private readonly contentFilterService: ContentFilterService,
  ) {}

  private mapToSafePhoto(photo: any): SafeProfilePhoto {
    const isApproved = photo.status === PhotoStatus.APPROVED;
    const fallbackUrl =
      isApproved && photo.objectKey && photo.objectKey !== 'pending'
        ? this.storageService.getPublicUrl(photo.objectKey)
        : null;

    return {
      id: photo.id,
      profileId: photo.profileId,
      status: photo.status as SharedPhotoStatus,
      position: photo.position,
      isPrimary: isApproved && photo.position === 0,
      thumbnailUrl:
        isApproved && photo.thumbnailKey
          ? this.storageService.getPublicUrl(photo.thumbnailKey)
          : fallbackUrl,
      mediumUrl:
        isApproved && photo.mediumKey
          ? this.storageService.getPublicUrl(photo.mediumKey)
          : fallbackUrl,
      largeUrl:
        isApproved && photo.largeKey
          ? this.storageService.getPublicUrl(photo.largeKey)
          : fallbackUrl,
      width: photo.width,
      height: photo.height,
      createdAt: photo.createdAt.toISOString(),
      updatedAt: photo.updatedAt.toISOString(),
    };
  }

  /**
   * Retrieves the authenticated user's dating profile, preferences, interests, and photos.
   */
  async getMe(userId: string): Promise<SafeDatingProfile | null> {
    const profile = await this.prisma.datingProfile.findUnique({
      where: { userId },
      include: {
        preferences: true,
        interests: {
          include: {
            interest: true,
          },
        },
        photos: {
          where: { status: { not: PhotoStatus.DELETED } },
          orderBy: { position: 'asc' },
        },
      },
    });

    if (!profile) {
      return null;
    }

    const interests = profile.interests.map((pi) => pi.interest);
    const validPhotosCount = profile.photos.filter(
      (p) => p.status !== PhotoStatus.DELETED && p.status !== PhotoStatus.REJECTED,
    ).length;

    const evaluation = this.completionService.evaluate(
      profile,
      profile.preferences,
      interests.length,
      validPhotosCount,
    );

    return {
      id: profile.id,
      userId: profile.userId,
      displayName: profile.displayName,
      age: evaluation.age,
      gender: profile.gender as any,
      bio: profile.bio,
      locationCity: profile.locationCity,
      locationRegion: profile.locationRegion,
      locationCountry: profile.locationCountry,
      visibility: profile.visibility as any,
      status: evaluation.status,
      completionScore: evaluation.completionScore,
      preferences: profile.preferences
        ? {
            id: profile.preferences.id,
            profileId: profile.preferences.profileId,
            preferredGenderMode: profile.preferences.preferredGenderMode as any,
            preferredGenders: profile.preferences.preferredGenders as any,
            minAge: profile.preferences.minAge,
            maxAge: profile.preferences.maxAge,
            relationshipIntent: profile.preferences.relationshipIntent as any,
            createdAt: profile.preferences.createdAt.toISOString(),
            updatedAt: profile.preferences.updatedAt.toISOString(),
          }
        : null,
      interests: interests.map((i) => ({
        id: i.id,
        name: i.name,
        category: i.category,
        status: i.status as any,
      })),
      photos: profile.photos.map((p) => this.mapToSafePhoto(p)),
      latitude: profile.latitude,
      longitude: profile.longitude,
      createdAt: profile.createdAt.toISOString(),
      updatedAt: profile.updatedAt.toISOString(),
    };
  }

  /**
   * Step 1: Upserts identity information (displayName, dateOfBirth, gender).
   */
  async updateIdentity(
    userId: string,
    dto: UpdateIdentityDto,
  ): Promise<SafeDatingProfile> {
    const dobValidation = validateDobEligibility(dto.dateOfBirth);
    if (!dobValidation.isValid || !dobValidation.dateOfBirth) {
      throw new BadRequestException(
        dobValidation.error || 'Invalid date of birth.',
      );
    }

    const trimmedName = dto.displayName.trim();
    if (trimmedName.length < 2 || trimmedName.length > 50) {
      throw new BadRequestException(
        'Display name must be between 2 and 50 characters.',
      );
    }

    this.contentFilterService.validateOrThrow(trimmedName, 'PROFILE');

    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.datingProfile.findUnique({
        where: { userId },
        include: { preferences: true, interests: true, photos: true },
      });

      let profileId: string;

      if (existing) {
        profileId = existing.id;
        await tx.datingProfile.update({
          where: { id: profileId },
          data: {
            displayName: trimmedName,
            dateOfBirth: dobValidation.dateOfBirth!,
            gender: dto.gender,
          },
        });
      } else {
        const created = await tx.datingProfile.create({
          data: {
            userId,
            displayName: trimmedName,
            dateOfBirth: dobValidation.dateOfBirth!,
            gender: dto.gender,
            visibility: ProfileVisibility.HIDDEN,
            status: ProfileStatus.IN_PROGRESS,
          },
        });
        profileId = created.id;
      }

      // Re-evaluate and sync status
      const updated = await tx.datingProfile.findUnique({
        where: { id: profileId },
        include: { preferences: true, interests: true, photos: true },
      });

      if (updated) {
        const validPhotosCount = updated.photos.filter(
          (p) => p.status !== PhotoStatus.DELETED && p.status !== PhotoStatus.REJECTED,
        ).length;
        const evaluation = this.completionService.evaluate(
          updated,
          updated.preferences,
          updated.interests.length,
          validPhotosCount,
        );

        if (updated.status !== (evaluation.status as any)) {
          await tx.datingProfile.update({
            where: { id: profileId },
            data: {
              status: evaluation.status as any,
              ...(evaluation.isReady ? { visibility: ProfileVisibility.VISIBLE } : {}),
            },
          });
        }
      }
    });

    const result = await this.getMe(userId);
    return result!;
  }

  /**
   * Step 2: Upserts dating preferences.
   */
  async updatePreferences(
    userId: string,
    dto: UpdatePreferencesDto,
  ): Promise<SafeDatingProfile> {
    const profile = await this.prisma.datingProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException(
        'Profile not found. Please complete identity details first.',
      );
    }

    if (dto.minAge < 18 || dto.maxAge > 99 || dto.minAge > dto.maxAge) {
      throw new BadRequestException(
        'Invalid age range: minAge must be at least 18 and less than or equal to maxAge.',
      );
    }

    const isSelectedMode =
      dto.preferredGenderMode === PreferredGenderMode.SELECTED;

    if (
      isSelectedMode &&
      (!dto.preferredGenders || dto.preferredGenders.length === 0)
    ) {
      throw new BadRequestException(
        'Please select at least one preferred gender when mode is SELECTED.',
      );
    }

    const preferredGenders = !isSelectedMode
      ? []
      : (dto.preferredGenders as Gender[]) || [];

    await this.prisma.$transaction(async (tx) => {
      await tx.datingPreferences.upsert({
        where: { profileId: profile.id },
        update: {
          preferredGenderMode: dto.preferredGenderMode,
          preferredGenders,
          minAge: dto.minAge,
          maxAge: dto.maxAge,
          relationshipIntent: dto.relationshipIntent,
        },
        create: {
          profileId: profile.id,
          preferredGenderMode: dto.preferredGenderMode,
          preferredGenders,
          minAge: dto.minAge,
          maxAge: dto.maxAge,
          relationshipIntent: dto.relationshipIntent,
        },
      });

      const updated = await tx.datingProfile.findUnique({
        where: { id: profile.id },
        include: { preferences: true, interests: true, photos: true },
      });

      if (updated) {
        const validPhotosCount = updated.photos.filter(
          (p) => p.status !== PhotoStatus.DELETED && p.status !== PhotoStatus.REJECTED,
        ).length;
        const evaluation = this.completionService.evaluate(
          updated,
          updated.preferences,
          updated.interests.length,
          validPhotosCount,
        );

        if (updated.status !== (evaluation.status as any)) {
          await tx.datingProfile.update({
            where: { id: profile.id },
            data: {
              status: evaluation.status as any,
              ...(evaluation.isReady ? { visibility: ProfileVisibility.VISIBLE } : {}),
            },
          });
        }
      }
    });

    const result = await this.getMe(userId);
    return result!;
  }

  /**
   * Step 3: Sets selected profile interests.
   */
  async updateInterests(
    userId: string,
    dto: UpdateInterestsDto,
  ): Promise<SafeDatingProfile> {
    const profile = await this.prisma.datingProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException(
        'Profile not found. Please complete identity details first.',
      );
    }

    const uniqueIds = Array.from(new Set(dto.interestIds));
    if (uniqueIds.length < 3 || uniqueIds.length > 15) {
      throw new BadRequestException(
        'Please select between 3 and 15 interests.',
      );
    }

    const validation =
      await this.interestsService.validateInterestIds(uniqueIds);
    if (!validation.isValid) {
      throw new BadRequestException(
        `Invalid or inactive interest IDs: ${validation.invalidIds.join(', ')}`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.profileInterest.deleteMany({
        where: { profileId: profile.id },
      });

      await tx.profileInterest.createMany({
        data: uniqueIds.map((interestId) => ({
          profileId: profile.id,
          interestId,
        })),
      });

      const updated = await tx.datingProfile.findUnique({
        where: { id: profile.id },
        include: { preferences: true, interests: true, photos: true },
      });

      if (updated) {
        const validPhotosCount = updated.photos.filter(
          (p) => p.status !== PhotoStatus.DELETED && p.status !== PhotoStatus.REJECTED,
        ).length;
        const evaluation = this.completionService.evaluate(
          updated,
          updated.preferences,
          updated.interests.length,
          validPhotosCount,
        );

        if (updated.status !== (evaluation.status as any)) {
          await tx.datingProfile.update({
            where: { id: profile.id },
            data: {
              status: evaluation.status as any,
              ...(evaluation.isReady ? { visibility: ProfileVisibility.VISIBLE } : {}),
            },
          });
        }
      }
    });

    const result = await this.getMe(userId);
    return result!;
  }

  /**
   * Step 4: Upserts about & location.
   */
  async updateAboutLocation(
    userId: string,
    dto: UpdateAboutLocationDto,
  ): Promise<SafeDatingProfile> {
    const profile = await this.prisma.datingProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException(
        'Profile not found. Please complete identity details first.',
      );
    }

    const trimmedBio = dto.bio?.trim();
    if (trimmedBio && trimmedBio.length > 500) {
      throw new BadRequestException('Bio cannot exceed 500 characters.');
    }
    if (trimmedBio) {
      this.contentFilterService.validateOrThrow(trimmedBio, 'PROFILE');
    }

    const trimmedCity = dto.locationCity.trim();
    if (trimmedCity.length < 2 || trimmedCity.length > 60) {
      throw new BadRequestException(
        'City name must be between 2 and 60 characters.',
      );
    }
    this.contentFilterService.validateOrThrow(trimmedCity, 'PROFILE');

    const trimmedRegion = dto.locationRegion?.trim();
    if (trimmedRegion) {
      this.contentFilterService.validateOrThrow(trimmedRegion, 'PROFILE');
    }

    const hasCoordinates = isValidCoordinate(dto.latitude, dto.longitude);

    await this.prisma.$transaction(async (tx) => {
      await tx.datingProfile.update({
        where: { id: profile.id },
        data: {
          bio: trimmedBio || null,
          locationCity: trimmedCity,
          locationRegion: trimmedRegion || null,
          ...(hasCoordinates
            ? {
                latitude: dto.latitude,
                longitude: dto.longitude,
                locationUpdatedAt: new Date(),
              }
            : {}),
        },
      });

      const updated = await tx.datingProfile.findUnique({
        where: { id: profile.id },
        include: { preferences: true, interests: true, photos: true },
      });

      if (updated) {
        const validPhotosCount = updated.photos.filter(
          (p) => p.status !== PhotoStatus.DELETED && p.status !== PhotoStatus.REJECTED,
        ).length;
        const evaluation = this.completionService.evaluate(
          updated,
          updated.preferences,
          updated.interests.length,
          validPhotosCount,
        );

        if (updated.status !== (evaluation.status as any)) {
          await tx.datingProfile.update({
            where: { id: profile.id },
            data: {
              status: evaluation.status as any,
              ...(evaluation.isReady ? { visibility: ProfileVisibility.VISIBLE } : {}),
            },
          });
        }
      }
    });

    const result = await this.getMe(userId);
    return result!;
  }

  /**
   * Silently updates user's current GPS coordinates (e.g. on mobile app foreground).
   */
  async updateLocationCoords(
    userId: string,
    latitude: number,
    longitude: number,
    locationCity?: string,
    locationRegion?: string,
  ): Promise<{ success: boolean }> {
    if (!isValidCoordinate(latitude, longitude)) {
      throw new BadRequestException('Invalid coordinates provided.');
    }

    await this.prisma.datingProfile.updateMany({
      where: { userId },
      data: {
        latitude,
        longitude,
        locationUpdatedAt: new Date(),
        ...(locationCity ? { locationCity: locationCity.trim() } : {}),
        ...(locationRegion ? { locationRegion: locationRegion.trim() } : {}),
      },
    });

    return { success: true };
  }

  /**
   * Toggles profile visibility (VISIBLE / HIDDEN).
   * Strictly prevents VISIBLE if profile is not READY.
   */
  async updateVisibility(
    userId: string,
    visibility: ProfileVisibility,
  ): Promise<SafeDatingProfile> {
    const profile = await this.prisma.datingProfile.findUnique({
      where: { userId },
      include: { preferences: true, interests: true, photos: true },
    });

    if (!profile) {
      throw new NotFoundException('Profile not found.');
    }

    const validPhotosCount = profile.photos.filter(
      (p) => p.status !== PhotoStatus.DELETED && p.status !== PhotoStatus.REJECTED,
    ).length;

    const evaluation = this.completionService.evaluate(
      profile,
      profile.preferences,
      profile.interests.length,
      validPhotosCount,
    );

    if (visibility === ProfileVisibility.VISIBLE && !evaluation.isReady) {
      throw new BadRequestException(
        `Cannot make profile visible before completing all required onboarding sections. Missing: ${evaluation.missingFields.join(', ')}`,
      );
    }

    await this.prisma.datingProfile.update({
      where: { id: profile.id },
      data: { visibility },
    });

    const result = await this.getMe(userId);
    return result!;
  }

  /**
   * Retrieves dynamic real-time completion breakdown and missing fields.
   */
  async getCompletion(userId: string): Promise<ProfileCompletionResult> {
    const profile = await this.prisma.datingProfile.findUnique({
      where: { userId },
      include: { preferences: true, interests: true, photos: true },
    });

    if (!profile) {
      return {
        completionScore: 0,
        status: ProfileStatus.NOT_STARTED as any,
        missingFields: [
          'identity',
          'preferences',
          'interests',
          'about-location',
          'photos',
        ],
        isReady: false,
      };
    }

    const validPhotosCount = profile.photos.filter(
      (p) => p.status !== PhotoStatus.DELETED && p.status !== PhotoStatus.REJECTED,
    ).length;

    const evaluation = this.completionService.evaluate(
      profile,
      profile.preferences,
      profile.interests.length,
      validPhotosCount,
    );

    return {
      completionScore: evaluation.completionScore,
      status: evaluation.status,
      missingFields: evaluation.missingFields,
      isReady: evaluation.isReady,
    };
  }

  /**
   * Retrieves a full viewable profile for an authenticated user, enforcing SafetyPolicyService,
   * active account status, profile visibility rules, and exposing only approved photos.
   */
  async getViewableProfile(
    requesterUserId: string,
    profileId: string,
  ): Promise<ViewableProfileDto> {
    // 1. Fetch target profile
    const profile = await this.prisma.datingProfile.findFirst({
      where: {
        OR: [{ id: profileId }, { userId: profileId }],
      },
      include: {
        user: true,
        preferences: true,
        interests: {
          include: { interest: true },
        },
        photos: {
          where: { status: PhotoStatus.APPROVED },
          orderBy: { position: 'asc' },
        },
      },
    });

    if (!profile) {
      throw new NotFoundException('Profile not found.');
    }

    // 2. Authoritative Safety Gate check
    const canView = await this.safetyPolicyService.canViewProfile(
      requesterUserId,
      profile.userId,
    );

    if (!canView) {
      throw new ForbiddenException(
        'Profile unavailable due to safety restrictions or inactive account.',
      );
    }

    // 3. Visibility Check (if hidden and not owner, check active match)
    if (
      profile.visibility === ProfileVisibility.HIDDEN &&
      requesterUserId !== profile.userId
    ) {
      const match = await this.prisma.match.findFirst({
        where: {
          status: MatchStatus.ACTIVE,
          OR: [
            { user1Id: requesterUserId, user2Id: profile.userId },
            { user1Id: profile.userId, user2Id: requesterUserId },
          ],
        },
      });

      if (!match) {
        throw new NotFoundException('Profile is currently hidden.');
      }
    }

    const age = calculateAge(profile.dateOfBirth);

    const requesterProfile = await this.prisma.datingProfile.findUnique({
      where: { userId: requesterUserId },
      select: { latitude: true, longitude: true, locationCity: true },
    });

    const { distanceKm, distanceDisplay } = calculateRelativeDistance(
      requesterProfile?.latitude,
      requesterProfile?.longitude,
      requesterProfile?.locationCity,
      profile.latitude,
      profile.longitude,
      profile.locationCity,
      profile.locationRegion,
    );

    return {
      profileId: profile.id,
      userId: profile.userId,
      displayName: profile.displayName,
      age,
      gender: profile.gender as any,
      bio: profile.bio,
      locationCity: profile.locationCity,
      locationRegion: profile.locationRegion,
      locationCountry: profile.locationCountry,
      relationshipIntent: profile.preferences
        ? (profile.preferences.relationshipIntent as any)
        : null,
      interests: profile.interests.map((pi) => ({
        id: pi.interest.id,
        name: pi.interest.name,
        category: pi.interest.category,
      })),
      photos: profile.photos.map((p) => this.mapToSafePhoto(p)),
      distanceKm,
      distanceDisplay,
    };
  }
}
