import { DiversityService } from './diversity.service';
import { RankedCandidate } from '../strategies/ranking.strategy.interface';

describe('DiversityService', () => {
  let service: DiversityService;

  beforeEach(() => {
    service = new DiversityService();
  });

  it('should interleave candidates to avoid homogeneous streaks exceeding threshold', () => {
    const dummyFeatures = {
      ageProximity: 1,
      interestOverlap: 1,
      sharedInterestsCount: 3,
      locationMatch: 1,
      intentMatch: 1,
      qualityScore: 1,
      freshnessScore: 1,
    };

    // 4 Bengaluru candidates followed by 1 Mumbai candidate
    const ranked: RankedCandidate[] = [
      {
        candidate: { id: 'c1', locationCity: 'Bengaluru' },
        score: 0.95,
        features: dummyFeatures,
      },
      {
        candidate: { id: 'c2', locationCity: 'Bengaluru' },
        score: 0.94,
        features: dummyFeatures,
      },
      {
        candidate: { id: 'c3', locationCity: 'Bengaluru' },
        score: 0.93,
        features: dummyFeatures,
      },
      {
        candidate: { id: 'c4', locationCity: 'Bengaluru' },
        score: 0.92,
        features: dummyFeatures,
      },
      {
        candidate: { id: 'c5', locationCity: 'Mumbai' },
        score: 0.91,
        features: dummyFeatures,
      },
    ];

    const diverse = service.applyDiversity(ranked);

    expect(diverse.length).toBe(5);
    // The 4th item (index 3) should now be Mumbai (c5) rather than 4th Bengaluru in a row
    expect(diverse[3].candidate.id).toBe('c5');
    expect(diverse[4].candidate.id).toBe('c4');
  });
});
