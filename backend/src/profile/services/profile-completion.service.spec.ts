import { ProfileCompletionService } from './profile-completion.service';
import {
  DatingProfile,
  DatingPreferences,
  ProfileStatus,
  ProfileVisibility,
  Gender,
  PreferredGenderMode,
  RelationshipIntent,
} from '@prisma/client';

describe('ProfileCompletionService', () => {
  let completionService: ProfileCompletionService;

  beforeEach(() => {
    completionService = new ProfileCompletionService();
  });

  const baseProfile: DatingProfile = {
    id: 'prof-123',
    userId: 'user-123',
    displayName: 'Aarav Sharma',
    dateOfBirth: new Date('2000-01-15T00:00:00.000Z'),
    gender: Gender.MAN,
    bio: null,
    locationCity: null,
    locationRegion: null,
    locationCountry: 'IN',
    visibility: ProfileVisibility.HIDDEN,
    status: ProfileStatus.NOT_STARTED,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPreferences: DatingPreferences = {
    id: 'pref-123',
    profileId: 'prof-123',
    preferredGenderMode: PreferredGenderMode.SELECTED,
    preferredGenders: [Gender.WOMAN],
    minAge: 21,
    maxAge: 30,
    relationshipIntent: RelationshipIntent.LONG_TERM,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it('should return 0 score and NOT_STARTED for null profile', () => {
    const result = completionService.evaluate(null, null, 0, 0);
    expect(result.completionScore).toBe(0);
    expect(result.status).toBe(ProfileStatus.NOT_STARTED);
    expect(result.isReady).toBe(false);
    expect(result.missingFields).toContain('photos');
  });

  it('should calculate 20% for Identity only', () => {
    const result = completionService.evaluate(baseProfile, null, 0, 0);
    expect(result.completionScore).toBe(20);
    expect(result.status).toBe(ProfileStatus.IN_PROGRESS);
    expect(result.isReady).toBe(false);
    expect(result.missingFields).toContain('preferences');
    expect(result.missingFields).toContain('interests');
    expect(result.missingFields).toContain('bio');
    expect(result.missingFields).toContain('photos');
  });

  it('should calculate 40% for Identity + Preferences', () => {
    const result = completionService.evaluate(
      baseProfile,
      mockPreferences,
      0,
      0,
    );
    expect(result.completionScore).toBe(40);
    expect(result.status).toBe(ProfileStatus.IN_PROGRESS);
    expect(result.isReady).toBe(false);
  });

  it('should calculate 60% for Identity + Preferences + 3 Interests', () => {
    const result = completionService.evaluate(
      baseProfile,
      mockPreferences,
      3,
      0,
    );
    expect(result.completionScore).toBe(60);
    expect(result.status).toBe(ProfileStatus.IN_PROGRESS);
    expect(result.isReady).toBe(false);
  });

  it('should calculate 80% for Identity + Preferences + 3 Interests + Bio/Location (without photos)', () => {
    const fullProfile: DatingProfile = {
      ...baseProfile,
      bio: 'Software engineer who loves hiking, coffee and live music.',
      locationCity: 'Bengaluru',
      locationRegion: 'Karnataka',
    };
    const result = completionService.evaluate(
      fullProfile,
      mockPreferences,
      3,
      0,
    );
    expect(result.completionScore).toBe(80);
    expect(result.status).toBe(ProfileStatus.IN_PROGRESS);
    expect(result.isReady).toBe(false);
    expect(result.missingFields).toContain('photos');
  });

  it('should calculate 100% and READY when all 5 milestones (including >= 1 approved photo) are satisfied', () => {
    const fullProfile: DatingProfile = {
      ...baseProfile,
      bio: 'Software engineer who loves hiking, coffee and live music.',
      locationCity: 'Bengaluru',
      locationRegion: 'Karnataka',
    };
    const result = completionService.evaluate(
      fullProfile,
      mockPreferences,
      3,
      1,
    );
    expect(result.completionScore).toBe(100);
    expect(result.status).toBe(ProfileStatus.READY);
    expect(result.isReady).toBe(true);
    expect(result.missingFields.length).toBe(0);
  });

  it('should not award more than 20% for having 6 approved photos (milestone capped at 20%)', () => {
    const fullProfile: DatingProfile = {
      ...baseProfile,
      bio: 'Software engineer who loves hiking, coffee and live music.',
      locationCity: 'Bengaluru',
      locationRegion: 'Karnataka',
    };
    const result = completionService.evaluate(
      fullProfile,
      mockPreferences,
      3,
      6,
    );
    expect(result.completionScore).toBe(100);
    expect(result.isReady).toBe(true);
  });
});
