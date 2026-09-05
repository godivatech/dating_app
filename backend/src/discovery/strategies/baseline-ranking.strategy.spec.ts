import { BaselineRankingStrategy } from './baseline-ranking.strategy';
import { FeatureExtractionService } from '../services/feature-extraction.service';
import { RelationshipIntent, PhotoStatus } from '@prisma/client';

describe('BaselineRankingStrategy', () => {
  let strategy: BaselineRankingStrategy;
  let featureExtractor: FeatureExtractionService;

  beforeEach(() => {
    featureExtractor = new FeatureExtractionService();
    strategy = new BaselineRankingStrategy(featureExtractor);
  });

  const user = {
    id: 'user-base',
    locationCity: 'Bengaluru',
    locationRegion: 'Karnataka',
    locationCountry: 'IN',
    preferences: {
      minAge: 22,
      maxAge: 30,
      relationshipIntent: RelationshipIntent.LONG_TERM,
    },
    interests: [{ interestId: 'hiking' }, { interestId: 'coffee' }],
  };

  it('should rank high-match candidate (same city, same intent, shared interests) higher than low-match candidate', () => {
    const highMatch = {
      id: 'high-1',
      dateOfBirth: new Date('1999-01-01T00:00:00.000Z'), // age 27 (close to midpoint 26)
      locationCity: 'Bengaluru',
      locationRegion: 'Karnataka',
      locationCountry: 'IN',
      preferences: { relationshipIntent: RelationshipIntent.LONG_TERM },
      interests: [{ interestId: 'hiking' }, { interestId: 'coffee' }],
      bio: 'Enthusiastic explorer and coffee connoisseur in the city.',
      photos: [
        { status: PhotoStatus.APPROVED },
        { status: PhotoStatus.APPROVED },
      ],
      updatedAt: new Date(),
    };

    const lowMatch = {
      id: 'low-1',
      dateOfBirth: new Date('1996-01-01T00:00:00.000Z'),
      locationCity: 'Delhi',
      locationRegion: 'Delhi',
      locationCountry: 'IN',
      preferences: { relationshipIntent: RelationshipIntent.CASUAL },
      interests: [{ interestId: 'gaming' }],
      bio: 'Just looking around',
      photos: [{ status: PhotoStatus.APPROVED }],
      updatedAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
    };

    const ranked = strategy.rankCandidates(user, [lowMatch, highMatch]);

    expect(ranked.length).toBe(2);
    expect(ranked[0].candidate.id).toBe('high-1');
    expect(ranked[1].candidate.id).toBe('low-1');
    expect(ranked[0].score).toBeGreaterThan(ranked[1].score);
    expect(strategy.version).toBe('baseline-v1');
  });
});
