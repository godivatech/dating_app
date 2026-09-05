import { Injectable } from '@nestjs/common';
import {
  UserStatus,
  ProfileStatus,
  ProfileVisibility,
  PhotoStatus,
} from '@prisma/client';
import { calculateAge } from '../../profile/utils/age.util';
import { DiscoveryEligibilityStatus } from '../../../../shared/src/types';

@Injectable()
export class DiscoveryEligibilityService {
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
      };
    }

    if (profile.status !== ProfileStatus.READY) {
      return {
        eligible: false,
        reason: 'PROFILE_NOT_READY',
        message:
          'Your profile must be 100% complete and ready before accessing discovery.',
      };
    }

    if (profile.visibility !== ProfileVisibility.VISIBLE) {
      return {
        eligible: false,
        reason: 'PROFILE_HIDDEN',
        message:
          'Your profile is currently hidden from discovery. Enable discovery visibility in settings to find matches.',
      };
    }

    const approvedPhotos = profile.photos?.filter(
      (p: any) => p.status === PhotoStatus.APPROVED,
    );
    if (!approvedPhotos || approvedPhotos.length === 0) {
      return {
        eligible: false,
        reason: 'NO_APPROVED_PHOTOS',
        message:
          'You need at least one approved profile photo to use discovery.',
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
    };
  }
}
