import { DiscoveryFeatures } from '../services/feature-extraction.service';

export interface RankedCandidate {
  candidate: any;
  score: number;
  features: DiscoveryFeatures;
}

export const RANKING_STRATEGY = 'RANKING_STRATEGY';

export interface RankingStrategy {
  readonly version: string;
  rankCandidates(userProfile: any, candidates: any[]): RankedCandidate[];
}
