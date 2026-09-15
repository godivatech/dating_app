import { Injectable } from '@nestjs/common';
import { calculateAge } from '../../profile/utils/age.util';
import { RelationshipIntent } from '@prisma/client';
import {
  calculateHaversineDistanceKm,
  isValidCoordinate,
} from '../utils/geo-distance.util';

export interface DiscoveryFeatures {
  ageProximity: number; // 0.0 to 1.0
  interestOverlap: number; // 0.0 to 1.0 (Jaccard similarity)
  sharedInterestsCount: number;
  languageOverlap: number; // 0.0 to 1.0
  sharedLanguagesCount: number;
  locationMatch: number; // 0.0 to 1.0
  intentMatch: number; // 0.0 to 1.0
  qualityScore: number; // 0.0 to 1.0
  freshnessScore: number; // 0.0 to 1.0
}

@Injectable()
export class FeatureExtractionService {
  /**
   * Extracts normalized discovery features between requesting user and candidate profile.
   */
  extractFeatures(userProfile: any, candidateProfile: any): DiscoveryFeatures {
    const ageProximity = this.calculateAgeProximity(
      userProfile?.preferences,
      candidateProfile?.dateOfBirth,
    );

    const { overlap: interestOverlap, count: sharedInterestsCount } =
      this.calculateInterestOverlap(
        userProfile?.interests,
        candidateProfile?.interests,
      );

    const { overlap: languageOverlap, count: sharedLanguagesCount } =
      this.calculateLanguageOverlap(userProfile, candidateProfile);

    const locationMatch = this.calculateLocationMatch(
      userProfile,
      candidateProfile,
    );

    const intentMatch = this.calculateIntentMatch(
      userProfile?.preferences?.relationshipIntent,
      candidateProfile?.preferences?.relationshipIntent,
    );

    const qualityScore = this.calculateQualityScore(candidateProfile);
    const freshnessScore = this.calculateFreshnessScore(candidateProfile);

    return {
      ageProximity,
      interestOverlap,
      sharedInterestsCount,
      languageOverlap,
      sharedLanguagesCount,
      locationMatch,
      intentMatch,
      qualityScore,
      freshnessScore,
    };
  }

  private calculateAgeProximity(
    preferences?: any,
    candidateDob?: Date,
  ): number {
    if (!preferences || !candidateDob) return 0.5;
    try {
      const candidateAge = calculateAge(candidateDob);
      const midpoint = (preferences.minAge + preferences.maxAge) / 2;
      const halfSpan = Math.max(
        (preferences.maxAge - preferences.minAge) / 2,
        1,
      );
      const distance = Math.abs(candidateAge - midpoint);
      return Math.max(0, 1.0 - distance / halfSpan);
    } catch {
      return 0.5;
    }
  }

  private calculateInterestOverlap(
    userInterests?: any[],
    candidateInterests?: any[],
  ): { overlap: number; count: number } {
    if (!userInterests || !candidateInterests) {
      return { overlap: 0, count: 0 };
    }

    const setA = new Set(userInterests.map((i: any) => i.interestId || i.id));
    const setB = new Set(
      candidateInterests.map((i: any) => i.interestId || i.id),
    );

    if (setA.size === 0 || setB.size === 0) {
      return { overlap: 0, count: 0 };
    }

    let shared = 0;
    for (const id of setA) {
      if (setB.has(id)) shared++;
    }

    const unionSize = setA.size + setB.size - shared;
    const jaccard = unionSize > 0 ? shared / unionSize : 0;

    return {
      overlap: Math.min(1.0, Math.max(0, jaccard)),
      count: shared,
    };
  }

  /**
   * Calculates language communication compatibility.
   * Compares candidate's spoken languages against user's spoken and preferred languages.
   */
  private calculateLanguageOverlap(
    userProfile?: any,
    candidateProfile?: any,
  ): { overlap: number; count: number } {
    if (!userProfile || !candidateProfile) {
      return { overlap: 0.5, count: 0 };
    }

    const userSpoken: string[] = Array.isArray(userProfile.languages)
      ? userProfile.languages
      : [];
    const userPreferred: string[] = Array.isArray(
      userProfile.preferences?.preferredLanguages,
    )
      ? userProfile.preferences.preferredLanguages
      : [];
    const candSpoken: string[] = Array.isArray(candidateProfile.languages)
      ? candidateProfile.languages
      : [];

    const userLangSet = new Set(
      [...userSpoken, ...userPreferred]
        .map((l) => (typeof l === 'string' ? l.trim().toLowerCase() : ''))
        .filter(Boolean),
    );

    const candLangSet = new Set(
      candSpoken
        .map((l) => (typeof l === 'string' ? l.trim().toLowerCase() : ''))
        .filter(Boolean),
    );

    // If neither profile has configured languages, neutral baseline
    if (userLangSet.size === 0 && candLangSet.size === 0) {
      return { overlap: 0.6, count: 0 };
    }

    // If user hasn't specified languages yet, neutral baseline
    if (userLangSet.size === 0) {
      return { overlap: 0.5, count: 0 };
    }

    // If candidate hasn't configured languages yet, soft default to avoid hard penalty
    if (candLangSet.size === 0) {
      return { overlap: 0.45, count: 0 };
    }

    let shared = 0;
    for (const lang of candLangSet) {
      if (userLangSet.has(lang)) {
        shared++;
      }
    }

    if (shared === 0) {
      // Both specified languages with 0 overlap (e.g., Tamil-only vs German-only)
      return { overlap: 0.1, count: 0 };
    }

    // High compatibility when sharing at least one language
    const ratio = shared / Math.min(userLangSet.size, candLangSet.size);
    const score = Math.min(1.0, 0.7 + 0.3 * ratio);

    return {
      overlap: score,
      count: shared,
    };
  }

  private calculateLocationMatch(user?: any, candidate?: any): number {
    if (!user || !candidate) return 0.0;

    const isGlobalMode = user?.preferences?.globalMode === true;

    // 1. If both profiles have valid GPS coordinates, compute geodesic distance score
    if (
      isValidCoordinate(user.latitude, user.longitude) &&
      isValidCoordinate(candidate.latitude, candidate.longitude)
    ) {
      const distanceKm = calculateHaversineDistanceKm(
        user.latitude,
        user.longitude,
        candidate.latitude,
        candidate.longitude,
      );

      if (distanceKm !== null) {
        if (distanceKm <= 5) return 1.0;
        if (distanceKm <= 15) return 0.95;
        if (distanceKm <= 30) return 0.85;

        // In Global Mode, distance penalties are significantly relaxed
        if (isGlobalMode) {
          return 0.85;
        }

        if (distanceKm <= 50) return 0.7;
        if (distanceKm <= 100) return 0.5;
        if (distanceKm <= 200) return 0.3;
        return Math.max(0.05, 1 / (1 + distanceKm / 50));
      }
    }

    // 2. Graceful hierarchical fallback based on City / Region / Country
    const userCity = user.locationCity?.trim().toLowerCase();
    const candCity = candidate.locationCity?.trim().toLowerCase();

    if (userCity && candCity && userCity === candCity) {
      return 1.0; // Same city
    }

    // In Global Mode, national or international candidates are welcomed
    if (isGlobalMode) {
      return 0.85;
    }

    const userRegion = user.locationRegion?.trim().toLowerCase();
    const candRegion = candidate.locationRegion?.trim().toLowerCase();

    if (userRegion && candRegion && userRegion === candRegion) {
      return 0.6; // Same state/region
    }

    const userCountry = (user.locationCountry || 'IN').trim().toUpperCase();
    const candCountry = (candidate.locationCountry || 'IN')
      .trim()
      .toUpperCase();

    if (userCountry === candCountry) {
      return 0.3; // Same country
    }

    return 0.0; // Different country
  }

  private calculateIntentMatch(
    userIntent?: RelationshipIntent,
    candidateIntent?: RelationshipIntent,
  ): number {
    if (!userIntent || !candidateIntent) return 0.5;

    // Exact Match
    if (userIntent === candidateIntent) {
      return 1.0;
    }

    // High compatibility pairings
    const highPairs = [
      [RelationshipIntent.LONG_TERM, RelationshipIntent.MARRIAGE],
      [RelationshipIntent.LONG_TERM, RelationshipIntent.SERIOUS_DATING],
      [RelationshipIntent.MARRIAGE, RelationshipIntent.SERIOUS_DATING],
      [RelationshipIntent.OPEN_TO_EXPLORE, RelationshipIntent.CASUAL],
      [RelationshipIntent.OPEN_TO_EXPLORE, RelationshipIntent.SERIOUS_DATING],
    ];

    const isHigh = highPairs.some(
      ([a, b]) =>
        (userIntent === a && candidateIntent === b) ||
        (userIntent === b && candidateIntent === a),
    );

    if (isHigh) {
      return 0.6;
    }

    return 0.2;
  }

  private calculateQualityScore(candidate?: any): number {
    if (!candidate) return 0.2;
    const photos = candidate.photos || [];
    let photoScore = 0.5;
    if (photos.length >= 4) photoScore = 1.0;
    else if (photos.length === 3) photoScore = 0.85;
    else if (photos.length === 2) photoScore = 0.7;

    const bio = candidate.bio?.trim() || '';
    let bioScore = 0.2;
    if (bio.length >= 150) bioScore = 1.0;
    else if (bio.length >= 80) bioScore = 0.8;
    else if (bio.length >= 30) bioScore = 0.6;
    else if (bio.length >= 10) bioScore = 0.4;

    return 0.6 * photoScore + 0.4 * bioScore;
  }

  private calculateFreshnessScore(candidate?: any): number {
    if (!candidate) return 0.2;
    const updatedAt = new Date(
      candidate.updatedAt || candidate.createdAt || Date.now(),
    );
    const diffHours = (Date.now() - updatedAt.getTime()) / (1000 * 60 * 60);

    if (diffHours <= 24) return 1.0;
    if (diffHours <= 24 * 7) return 0.8;
    if (diffHours <= 24 * 30) return 0.5;
    return 0.2;
  }
}
