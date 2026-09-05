import { FeatureExtractionService } from './feature-extraction.service';
import { RelationshipIntent, PhotoStatus } from '@prisma/client';

describe('FeatureExtractionService', () => {
  let service: FeatureExtractionService;

  beforeEach(() => {
    service = new FeatureExtractionService();
  });

  const user = {
    id: 'u-1',
    locationCity: 'Bengaluru',
    locationRegion: 'Karnataka',
    locationCountry: 'IN',
    preferences: {
      minAge: 20,
      maxAge: 30, // midpoint 25
      relationshipIntent: RelationshipIntent.LONG_TERM,
    },
    interests: [
      { interestId: 'hiking' },
      { interestId: 'coffee' },
      { interestId: 'music' },
    ],
  };

  it('should calculate location match hierarchy accurately', () => {
    const sameCity = {
      dateOfBirth: new Date('1998-05-15T00:00:00.000Z'),
      locationCity: 'Bengaluru',
      locationRegion: 'Karnataka',
      locationCountry: 'IN',
    };
    const sameRegion = {
      dateOfBirth: new Date('1998-05-15T00:00:00.000Z'),
      locationCity: 'Mysuru',
      locationRegion: 'Karnataka',
      locationCountry: 'IN',
    };
    const sameCountry = {
      dateOfBirth: new Date('1998-05-15T00:00:00.000Z'),
      locationCity: 'Mumbai',
      locationRegion: 'Maharashtra',
      locationCountry: 'IN',
    };
    const diffCountry = {
      dateOfBirth: new Date('1998-05-15T00:00:00.000Z'),
      locationCity: 'London',
      locationRegion: 'England',
      locationCountry: 'UK',
    };

    const featCity = service.extractFeatures(user, sameCity);
    const featRegion = service.extractFeatures(user, sameRegion);
    const featCountry = service.extractFeatures(user, sameCountry);
    const featDiff = service.extractFeatures(user, diffCountry);

    expect(featCity.locationMatch).toBe(1.0);
    expect(featRegion.locationMatch).toBe(0.6);
    expect(featCountry.locationMatch).toBe(0.3);
    expect(featDiff.locationMatch).toBe(0.0);
  });

  it('should calculate Jaccard interest overlap correctly', () => {
    // 2 shared out of 4 total unique (hiking, coffee, music, reading) -> Jaccard = 2/4 = 0.5
    const candidatePartial = {
      dateOfBirth: new Date('1998-05-15T00:00:00.000Z'),
      interests: [
        { interestId: 'hiking' },
        { interestId: 'coffee' },
        { interestId: 'reading' },
      ],
    };

    const features = service.extractFeatures(user, candidatePartial);
    expect(features.sharedInterestsCount).toBe(2);
    expect(features.interestOverlap).toBe(0.5);
  });

  it('should calculate intent match for exact and compatible pairings', () => {
    const candidateExact = {
      dateOfBirth: new Date('1998-05-15T00:00:00.000Z'),
      preferences: { relationshipIntent: RelationshipIntent.LONG_TERM },
    };
    const candidateCompatible = {
      dateOfBirth: new Date('1998-05-15T00:00:00.000Z'),
      preferences: { relationshipIntent: RelationshipIntent.MARRIAGE },
    };
    const candidateDisjoint = {
      dateOfBirth: new Date('1998-05-15T00:00:00.000Z'),
      preferences: { relationshipIntent: RelationshipIntent.CASUAL },
    };

    const featExact = service.extractFeatures(user, candidateExact);
    const featComp = service.extractFeatures(user, candidateCompatible);
    const featDisjoint = service.extractFeatures(user, candidateDisjoint);

    expect(featExact.intentMatch).toBe(1.0);
    expect(featComp.intentMatch).toBe(0.6);
    expect(featDisjoint.intentMatch).toBe(0.2);
  });

  it('should calculate high quality score for profile with 4+ photos and detailed bio', () => {
    const richCandidate = {
      dateOfBirth: new Date('1998-05-15T00:00:00.000Z'),
      bio: 'Lover of modern design, trail running, specialty pour-overs, and indie music concerts around Bengaluru. Always keen on deep conversations over great coffee and exploring new hiking trails across the Western Ghats.',
      photos: [
        { status: PhotoStatus.APPROVED },
        { status: PhotoStatus.APPROVED },
        { status: PhotoStatus.APPROVED },
        { status: PhotoStatus.APPROVED },
      ],
      updatedAt: new Date(),
    };

    const features = service.extractFeatures(user, richCandidate);
    expect(features.qualityScore).toBe(1.0);
    expect(features.freshnessScore).toBe(1.0);
  });
});
