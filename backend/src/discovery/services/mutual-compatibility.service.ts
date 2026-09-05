import { Injectable } from '@nestjs/common';
import { PreferredGenderMode } from '@prisma/client';
import { calculateAge } from '../../profile/utils/age.util';

export interface ProfileWithPreferences {
  id: string;
  gender: string;
  dateOfBirth: Date;
  preferences: {
    preferredGenderMode: PreferredGenderMode;
    preferredGenders: string[];
    minAge: number;
    maxAge: number;
  } | null;
}

@Injectable()
export class MutualCompatibilityService {
  /**
   * Evaluates reciprocal mutual preference compatibility between user A and candidate B.
   * Both (A accepts B) AND (B accepts A) across Gender AND Age must be satisfied.
   */
  isMutuallyCompatible(
    userA: ProfileWithPreferences,
    candidateB: ProfileWithPreferences,
  ): boolean {
    const prefA = userA.preferences || {
      preferredGenderMode: PreferredGenderMode.ANY,
      preferredGenders: [],
      minAge: 18,
      maxAge: 99,
    };
    const prefB = candidateB.preferences || {
      preferredGenderMode: PreferredGenderMode.ANY,
      preferredGenders: [],
      minAge: 18,
      maxAge: 99,
    };

    // 1. Reciprocal Gender Compatibility
    const aAcceptsBGender = this.checkGenderCompatibility(
      prefA,
      candidateB.gender,
    );
    if (!aAcceptsBGender) return false;

    const bAcceptsAGender = this.checkGenderCompatibility(
      prefB,
      userA.gender,
    );
    if (!bAcceptsAGender) return false;

    // 2. Reciprocal Age Compatibility (derived from UTC calendar DOB)
    const ageA = calculateAge(userA.dateOfBirth);
    const ageB = calculateAge(candidateB.dateOfBirth);

    // Hard minimum 18 requirement
    if (ageA < 18 || ageB < 18) {
      return false;
    }

    const aAcceptsBAge =
      ageB >= prefA.minAge && ageB <= prefA.maxAge;
    if (!aAcceptsBAge) return false;

    const bAcceptsAAge =
      ageA >= prefB.minAge &&
      ageA <= prefB.maxAge;
    if (!bAcceptsAAge) return false;

    return true;
  }

  /**
   * Helper to verify if preferences accept a given target gender.
   */
  private checkGenderCompatibility(
    preferences: {
      preferredGenderMode: PreferredGenderMode;
      preferredGenders: string[];
    },
    targetGender: string,
  ): boolean {
    if (preferences.preferredGenderMode === PreferredGenderMode.ANY) {
      return true;
    }

    if (
      preferences.preferredGenderMode === PreferredGenderMode.SELECTED &&
      preferences.preferredGenders
    ) {
      return preferences.preferredGenders.includes(targetGender);
    }

    return false;
  }
}
