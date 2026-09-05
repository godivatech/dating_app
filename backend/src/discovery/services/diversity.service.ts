import { Injectable } from '@nestjs/common';
import { RankedCandidate } from '../strategies/ranking.strategy.interface';

export const MAX_HOMOGENEOUS_STREAK = 3;

@Injectable()
export class DiversityService {
  /**
   * Applies a controlled diversity pass to prevent long streaks of identical
   * location or relationship intent within a discovery page.
   */
  applyDiversity(ranked: RankedCandidate[]): RankedCandidate[] {
    if (ranked.length <= MAX_HOMOGENEOUS_STREAK) {
      return ranked;
    }

    const result: RankedCandidate[] = [];
    const remaining = [...ranked];

    while (remaining.length > 0) {
      const nextCandidate = remaining[0];
      const isStreakViolated = this.checkStreakViolation(result, nextCandidate);

      if (isStreakViolated && remaining.length > 1) {
        // Look ahead up to 5 items to find a diverse alternate
        const lookaheadLimit = Math.min(remaining.length, 6);
        let diverseIndex = -1;

        for (let i = 1; i < lookaheadLimit; i++) {
          if (!this.checkStreakViolation(result, remaining[i])) {
            diverseIndex = i;
            break;
          }
        }

        if (diverseIndex !== -1) {
          // Take the diverse candidate
          const [diverseCandidate] = remaining.splice(diverseIndex, 1);
          result.push(diverseCandidate);
          continue;
        }
      }

      // Default: take highest ranked candidate
      result.push(remaining.shift()!);
    }

    return result;
  }

  private checkStreakViolation(
    currentList: RankedCandidate[],
    candidate: RankedCandidate,
  ): boolean {
    if (currentList.length < MAX_HOMOGENEOUS_STREAK) {
      return false;
    }

    const lastN = currentList.slice(-MAX_HOMOGENEOUS_STREAK);

    const candCity = candidate.candidate.locationCity?.trim().toLowerCase();
    if (candCity) {
      const allSameCity = lastN.every(
        (item) =>
          item.candidate.locationCity?.trim().toLowerCase() === candCity,
      );
      if (allSameCity) return true;
    }

    const candIntent =
      candidate.candidate.preferences?.relationshipIntent ||
      candidate.candidate.relationshipIntent;
    if (candIntent) {
      const allSameIntent = lastN.every(
        (item) =>
          (item.candidate.preferences?.relationshipIntent ||
            item.candidate.relationshipIntent) === candIntent,
      );
      if (allSameIntent) return true;
    }

    return false;
  }
}
