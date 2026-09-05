import { Injectable } from '@nestjs/common';
import { DatingProfile, DatingPreferences } from '@prisma/client';
import { calculateAge } from '../utils/age.util';
import {
  ProfileCompletionResult,
  ProfileStatus,
} from '../../../../shared/src/types';

export interface EvaluationDetails extends ProfileCompletionResult {
  age: number;
}

@Injectable()
export class ProfileCompletionService {
  /**
   * Evaluates completion score (0-100), status, missing fields, and readiness.
   *
   * 5 Milestones (20% each):
   * 1. Identity (20%): displayName, dateOfBirth (18+), gender
   * 2. Preferences (20%): preferences configured (age range, intent, gender mode)
   * 3. Interests (20%): >= 3 reference interests selected
   * 4. About & Location (20%): bio (>= 10 chars) and locationCity
   * 5. Photos (20%): >= 1 APPROVED profile photo
   */
  evaluate(
    profile: DatingProfile | null,
    preferences: DatingPreferences | null,
    interestsCount: number = 0,
    approvedPhotosCount: number = 0,
  ): EvaluationDetails {
    if (!profile) {
      return {
        completionScore: 0,
        status: ProfileStatus.NOT_STARTED,
        missingFields: [
          'identity',
          'preferences',
          'interests',
          'about-location',
          'photos',
        ],
        isReady: false,
        age: 0,
      };
    }

    const missingFields: string[] = [];
    let score = 0;

    // 1. Identity Milestone (20%)
    const age = calculateAge(profile.dateOfBirth);
    const hasValidIdentity =
      Boolean(profile.displayName) &&
      profile.displayName.trim().length >= 2 &&
      Boolean(profile.gender) &&
      age >= 18;

    if (hasValidIdentity) {
      score += 20;
    } else {
      missingFields.push('identity');
    }

    // 2. Preferences Milestone (20%)
    const hasValidPreferences =
      Boolean(preferences) &&
      preferences!.minAge >= 18 &&
      preferences!.maxAge <= 99 &&
      preferences!.minAge <= preferences!.maxAge &&
      Boolean(preferences!.relationshipIntent);

    if (hasValidPreferences) {
      score += 20;
    } else {
      missingFields.push('preferences');
    }

    // 3. Interests Milestone (20%)
    if (interestsCount >= 3) {
      score += 20;
    } else {
      missingFields.push('interests');
    }

    // 4. About & Location Milestone (20%)
    const hasValidBio =
      Boolean(profile.bio) && profile.bio!.trim().length >= 10;
    const hasValidCity =
      Boolean(profile.locationCity) && profile.locationCity!.trim().length >= 2;

    if (hasValidBio && hasValidCity) {
      score += 20;
    } else {
      if (!hasValidBio) missingFields.push('bio');
      if (!hasValidCity) missingFields.push('locationCity');
    }

    // 5. Photos Milestone (20%): Requires at least one APPROVED photo
    if (approvedPhotosCount >= 1) {
      score += 20;
    } else {
      missingFields.push('photos');
    }

    // Derived Status
    let status: ProfileStatus;
    if (score === 0) {
      status = ProfileStatus.NOT_STARTED;
    } else if (score === 100) {
      status = ProfileStatus.READY;
    } else {
      status = ProfileStatus.IN_PROGRESS;
    }

    return {
      completionScore: score,
      status,
      missingFields,
      isReady: score === 100,
      age,
    };
  }
}
