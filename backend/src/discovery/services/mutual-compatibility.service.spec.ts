import { MutualCompatibilityService } from './mutual-compatibility.service';
import { PreferredGenderMode, Gender } from '@prisma/client';

describe('MutualCompatibilityService', () => {
  let service: MutualCompatibilityService;

  beforeEach(() => {
    service = new MutualCompatibilityService();
  });

  const baseUserA = {
    id: 'user-a',
    gender: Gender.MAN,
    dateOfBirth: new Date('1998-05-15T00:00:00.000Z'), // 28 years old
    preferences: {
      preferredGenderMode: PreferredGenderMode.SELECTED,
      preferredGenders: [Gender.WOMAN],
      minAge: 22,
      maxAge: 30,
    },
  };

  const baseCandidateB = {
    id: 'candidate-b',
    gender: Gender.WOMAN,
    dateOfBirth: new Date('2000-01-20T00:00:00.000Z'), // 26 years old
    preferences: {
      preferredGenderMode: PreferredGenderMode.SELECTED,
      preferredGenders: [Gender.MAN],
      minAge: 25,
      maxAge: 32,
    },
  };

  it('should return true when gender and age preferences are mutually compatible', () => {
    const isCompatible = service.isMutuallyCompatible(
      baseUserA,
      baseCandidateB,
    );
    expect(isCompatible).toBe(true);
  });

  it('should return false if A accepts B gender, but B does NOT accept A gender', () => {
    const bOnlyWomen = {
      ...baseCandidateB,
      preferences: {
        ...baseCandidateB.preferences,
        preferredGenders: [Gender.WOMAN],
      },
    };

    const isCompatible = service.isMutuallyCompatible(baseUserA, bOnlyWomen);
    expect(isCompatible).toBe(false);
  });

  it('should return true when mode is ANY for both', () => {
    const aAny = {
      ...baseUserA,
      preferences: {
        ...baseUserA.preferences,
        preferredGenderMode: PreferredGenderMode.ANY,
        preferredGenders: [],
      },
    };
    const bAny = {
      ...baseCandidateB,
      preferences: {
        ...baseCandidateB.preferences,
        preferredGenderMode: PreferredGenderMode.ANY,
        preferredGenders: [],
      },
    };

    const isCompatible = service.isMutuallyCompatible(aAny, bAny);
    expect(isCompatible).toBe(true);
  });

  it('should return false if Candidate B is outside User A preferred age range', () => {
    const olderB = {
      ...baseCandidateB,
      dateOfBirth: new Date('1985-01-01T00:00:00.000Z'), // 41 years old (A wants 22-30)
    };

    const isCompatible = service.isMutuallyCompatible(baseUserA, olderB);
    expect(isCompatible).toBe(false);
  });

  it('should return false if User A is outside Candidate B preferred age range', () => {
    const bWantsYounger = {
      ...baseCandidateB,
      preferences: {
        ...baseCandidateB.preferences,
        minAge: 20,
        maxAge: 24, // A is 28
      },
    };

    const isCompatible = service.isMutuallyCompatible(baseUserA, bWantsYounger);
    expect(isCompatible).toBe(false);
  });

  it('should return false if either party is under 18', () => {
    const underageB = {
      ...baseCandidateB,
      dateOfBirth: new Date('2015-01-01T00:00:00.000Z'),
    };

    const isCompatible = service.isMutuallyCompatible(baseUserA, underageB);
    expect(isCompatible).toBe(false);
  });
});
