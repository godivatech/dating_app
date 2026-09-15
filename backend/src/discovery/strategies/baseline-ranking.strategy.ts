import { Injectable } from '@nestjs/common';
import { RankingStrategy, RankedCandidate } from './ranking.strategy.interface';
import { FeatureExtractionService } from '../services/feature-extraction.service';

export interface RankingWeights {
  location: number;
  language: number;
  intent: number;
  interests: number;
  ageProximity: number;
  quality: number;
  freshness: number;
}

export const LOCAL_RANKING_WEIGHTS: RankingWeights = {
  location: 0.22,
  language: 0.15,
  intent: 0.2,
  interests: 0.18,
  ageProximity: 0.12,
  quality: 0.08,
  freshness: 0.05,
};

export const GLOBAL_RANKING_WEIGHTS: RankingWeights = {
  location: 0.05,
  language: 0.25,
  intent: 0.25,
  interests: 0.22,
  ageProximity: 0.12,
  quality: 0.06,
  freshness: 0.05,
};

@Injectable()
export class BaselineRankingStrategy implements RankingStrategy {
  readonly version = 'baseline-v2-global-lang';

  constructor(private readonly featureExtractor: FeatureExtractionService) {}

  rankCandidates(userProfile: any, candidates: any[]): RankedCandidate[] {
    const ranked: RankedCandidate[] = [];
    const now = new Date();

    const isGlobalMode = userProfile?.preferences?.globalMode === true;
    const weights = isGlobalMode
      ? GLOBAL_RANKING_WEIGHTS
      : LOCAL_RANKING_WEIGHTS;

    for (const candidate of candidates) {
      const features = this.featureExtractor.extractFeatures(
        userProfile,
        candidate,
      );

      let score =
        features.locationMatch * weights.location +
        features.languageOverlap * weights.language +
        features.intentMatch * weights.intent +
        features.interestOverlap * weights.interests +
        features.ageProximity * weights.ageProximity +
        features.qualityScore * weights.quality +
        features.freshnessScore * weights.freshness;

      // Check active profile boost entitlement
      const isBoosted =
        candidate.isBoosted ||
        candidate.user?.entitlements?.some(
          (e: any) => !e.expiresAt || new Date(e.expiresAt) > now,
        );

      if (isBoosted) {
        candidate.isBoosted = true;
        score += 100.0; // Puts boosted profile at the front of candidate deck
      }

      ranked.push({
        candidate,
        score,
        features,
      });
    }

    // Sort descending by score; secondary tiebreaker on candidate.id for deterministic sorting
    return ranked.sort((a, b) => {
      if (Math.abs(b.score - a.score) > 0.0001) {
        return b.score - a.score;
      }
      return a.candidate.id.localeCompare(b.candidate.id);
    });
  }
}
