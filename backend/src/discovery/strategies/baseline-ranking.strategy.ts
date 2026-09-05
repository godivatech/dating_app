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

    for (const candidate of candidates) {
      const features = this.featureExtractor.extractFeatures(
        userProfile,
        candidate,
      );

      const score =
        features.locationMatch * this.weights.location +
        features.intentMatch * this.weights.intent +
        features.interestOverlap * this.weights.interests +
        features.ageProximity * this.weights.ageProximity +
        features.qualityScore * this.weights.quality +
        features.freshnessScore * this.weights.freshness;

      ranked.push({
        candidate,
        score: Math.min(1.0, Math.max(0, score)),
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
