import { Injectable } from '@nestjs/common';
import {
  UserStatus,
  ProfileStatus,
  ProfileVisibility,
  PhotoStatus,
} from '@prisma/client';
import { calculateAge } from '../../profile/utils/age.util';
import { ProfileCompletionService } from '../../profile/services/profile-completion.service';
import { DiscoveryEligibilityStatus } from '../../../../shared/src/types';

@Injectable()
export class DiscoveryEligibilityService {
  constructor(
    private readonly completionService: ProfileCompletionService,
  ) {}

  /**
   * Authoritative backend check verifying whether the requesting user is eligible
   * to view discovery candidates.
   */
  evaluateEligibility(user: any): DiscoveryEligibilityStatus {
    if (!user) {
      return {
        eligible: false,
        reason: 'ACCOUNT_NOT_ACTIVE',
        message: 'User account not found.',
        completionScore: 0,
        missingFields: ['identity', 'preferences', 'interests', 'about-location', 'photos'],
      };
    }

    if (user.status !== UserStatus.ACTIVE) {
      return {
        eligible: false,
        reason: 'ACCOUNT_NOT_ACTIVE',
        message: `Account status is ${user.status}. Discovery is only available for active accounts.`,
      };
    }

    const profile = user.profile;
    if (!profile) {
      return {
        eligible: false,
        reason: 'PROFILE_NOT_READY',
        message: 'Dating profile has not been created yet.',
        completionScore: 0,
        missingFields: ['identity', 'preferences', 'interests', 'about-location', 'photos'],
      };
    }

    const interestsCount = profile.interests?.length || 0;
    const validPhotosCount = profile.photos?.filter(
      (p: any) => p.status !== PhotoStatus.DELETED && p.status !== PhotoStatus.REJECTED,
    )?.length || 0;

    const evaluation = this.completionService.evaluate(
      profile,
      profile.preferences,
      interestsCount,
      validPhotosCount,
    );

    if (!evaluation.isReady) {
      return {
        eligible: false,
        reason: 'PROFILE_NOT_READY',
        message: 'Your profile must be complete before accessing discovery.',
        missingFields: evaluation.missingFields,
        completionScore: evaluation.completionScore,
      };
    }

    if (profile.visibility !== ProfileVisibility.VISIBLE) {
      return {
        eligible: false,
        reason: 'PROFILE_HIDDEN',
        message:
          'Your profile is currently hidden from discovery. Enable discovery visibility in settings to find matches.',
        completionScore: evaluation.completionScore,
      };
    }

    if (validPhotosCount === 0) {
      return {
        eligible: false,
        reason: 'NO_APPROVED_PHOTOS',
        message: 'You need at least one profile photo to use discovery.',
        missingFields: ['photos'],
        completionScore: evaluation.completionScore,
      };
    }

    const age = calculateAge(profile.dateOfBirth);
    if (age < 18) {
      return {
        eligible: false,
        reason: 'AGE_RESTRICTION',
        message: 'You must be at least 18 years old to use discovery.',
      };
    }

    return {
      eligible: true,
      completionScore: 100,
    };
  }
}
