import { Injectable } from '@nestjs/common';
import { RankingStrategy, RankedCandidate } from './ranking.strategy.interface';
import { FeatureExtractionService } from '../services/feature-extraction.service';

export interface RankingWeights {
  location: number;
  intent: number;
  interests: number;
  ageProximity: number;
  quality: number;
  freshness: number;
}

export const BASELINE_V1_WEIGHTS: RankingWeights = {
  location: 0.25,
  intent: 0.2,
  interests: 0.2,
  ageProximity: 0.15,
  quality: 0.1,
  freshness: 0.1,
};

@Injectable()
export class BaselineRankingStrategy implements RankingStrategy {
  readonly version = 'baseline-v1';
  private readonly weights: RankingWeights = BASELINE_V1_WEIGHTS;

  constructor(private readonly featureExtractor: FeatureExtractionService) {}

  rankCandidates(userProfile: any, candidates: any[]): RankedCandidate[] {
    const ranked: RankedCandidate[] = [];
    const now = new Date();

    for (const candidate of candidates) {
      const features = this.featureExtractor.extractFeatures(
        userProfile,
        candidate,
      );

      let score =
        features.locationMatch * this.weights.location +
        features.intentMatch * this.weights.intent +
        features.interestOverlap * this.weights.interests +
        features.ageProximity * this.weights.ageProximity +
        features.qualityScore * this.weights.quality +
        features.freshnessScore * this.weights.freshness;

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
