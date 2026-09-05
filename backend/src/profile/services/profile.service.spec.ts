import { BadRequestException } from '@nestjs/common';
import { ProfileService } from './profile.service';
import { ProfileCompletionService } from './profile-completion.service';
import {
  Gender,
  PreferredGenderMode,
  RelationshipIntent,
  ProfileVisibility,
  ProfileStatus,
  PhotoStatus,
} from '@prisma/client';

describe('ProfileService', () => {
  let profileService: ProfileService;
  let mockPrisma: any;
  let mockInterestsService: any;
  let mockStorageService: any;
  let completionService: ProfileCompletionService;

  const profileStore = new Map<string, any>();
  const preferenceStore = new Map<string, any>();
  const interestJoinStore = new Map<string, any>();
  const photoStore = new Map<string, any>();

  beforeEach(() => {
    profileStore.clear();
    preferenceStore.clear();
    interestJoinStore.clear();
    photoStore.clear();

    completionService = new ProfileCompletionService();

    mockInterestsService = {
      validateInterestIds: jest.fn().mockImplementation((ids: string[]) => {
        const valid = ids.every((id) => id.startsWith('valid-'));
        return Promise.resolve({
          isValid: valid,
          invalidIds: ids.filter((id) => !id.startsWith('valid-')),
        });
      }),
    };

    mockStorageService = {
      getPublicUrl: jest
        .fn()
        .mockImplementation((key) => `https://cdn.dating.local/${key}`),
    };

    mockPrisma = {
      datingProfile: {
        findUnique: jest.fn().mockImplementation(({ where }) => {
          let p: any = null;
          if (where.userId) {
            for (const item of profileStore.values()) {
              if (item.userId === where.userId) {
                p = item;
                break;
              }
            }
          } else if (where.id) {
            p = profileStore.get(where.id);
          }
          if (!p) return Promise.resolve(null);

          const prefs = preferenceStore.get(p.id) || null;
          const piList = Array.from(interestJoinStore.values()).filter(
            (pi) => pi.profileId === p.id,
          );
          const photos = Array.from(photoStore.values()).filter(
            (photo) =>
              photo.profileId === p.id && photo.status !== PhotoStatus.DELETED,
          );

          return Promise.resolve({
            ...p,
            preferences: prefs,
            interests: piList.map((pi) => ({
              interest: {
                id: pi.interestId,
                name: pi.interestId,
                category: 'General',
                status: 'ACTIVE',
              },
            })),
            photos,
          });
        }),
        findFirst: jest.fn().mockImplementation(({ where }) => {
          let p: any = null;
          if (where.OR) {
            for (const cond of where.OR) {
              if (cond.id && profileStore.has(cond.id)) {
                p = profileStore.get(cond.id);
                break;
              }
              if (cond.userId) {
                for (const item of profileStore.values()) {
                  if (item.userId === cond.userId) {
                    p = item;
                    break;
                  }
                }
              }
            }
          } else if (where.id) {
            p = profileStore.get(where.id);
          }
          if (!p) return Promise.resolve(null);

          const prefs = preferenceStore.get(p.id) || null;
          const piList = Array.from(interestJoinStore.values()).filter(
            (pi) => pi.profileId === p.id,
          );
          const photos = Array.from(photoStore.values()).filter(
            (photo) =>
              photo.profileId === p.id && photo.status !== PhotoStatus.DELETED,
          );

          return Promise.resolve({
            ...p,
            preferences: prefs,
            interests: piList.map((pi) => ({
              interest: {
                id: pi.interestId,
                name: pi.interestId,
                category: 'General',
                status: 'ACTIVE',
              },
            })),
            photos,
          });
        }),
        create: jest.fn().mockImplementation(({ data }) => {
          const p = {
            id: `prof-${Date.now()}`,
            ...data,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          profileStore.set(p.id, p);
          return Promise.resolve(p);
        }),
        update: jest.fn().mockImplementation(({ where, data }) => {
          const p = profileStore.get(where.id);
          if (!p) return Promise.resolve(null);
          Object.assign(p, data, { updatedAt: new Date() });
          profileStore.set(where.id, p);
          return Promise.resolve(p);
        }),
      },
      datingPreferences: {
        upsert: jest.fn().mockImplementation(({ where, update, create }) => {
          let pref = preferenceStore.get(where.profileId);
          if (pref) {
            Object.assign(pref, update, { updatedAt: new Date() });
          } else {
            pref = {
              id: `pref-${Date.now()}`,
              ...create,
              createdAt: new Date(),
              updatedAt: new Date(),
            };
          }
          preferenceStore.set(where.profileId, pref);
          return Promise.resolve(pref);
        }),
      },
      profileInterest: {
        deleteMany: jest.fn().mockImplementation(({ where }) => {
          for (const [key, val] of interestJoinStore.entries()) {
            if (val.profileId === where.profileId) {
              interestJoinStore.delete(key);
            }
          }
          return Promise.resolve({ count: 1 });
        }),
        createMany: jest.fn().mockImplementation(({ data }) => {
          for (const item of data) {
            interestJoinStore.set(`${item.profileId}_${item.interestId}`, {
              id: `pi-${Math.random()}`,
              ...item,
              createdAt: new Date(),
            });
          }
          return Promise.resolve({ count: data.length });
        }),
      },
      match: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      $transaction: jest.fn().mockImplementation(async (callback) => {
        return await callback(mockPrisma);
      }),
    };

    const mockSafetyPolicyService = {
      canViewProfile: jest.fn().mockResolvedValue(true),
    };

    const mockContentFilterService = {
      validateOrThrow: jest.fn(),
      scanText: jest.fn().mockReturnValue({ isClean: true, violations: [] }),
    };

    profileService = new ProfileService(
      mockPrisma,
      completionService,
      mockInterestsService,
      mockStorageService,
      mockSafetyPolicyService as any,
      mockContentFilterService as any,
    );
  });

  describe('updateIdentity', () => {
    it('should reject under-18 users with BadRequestException', async () => {
      await expect(
        profileService.updateIdentity('user-1', {
          displayName: 'Young User',
          dateOfBirth: '2020-01-01', // Age 6
          gender: Gender.MAN,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create initial profile with fail-closed HIDDEN visibility and IN_PROGRESS status (20%)', async () => {
      const result = await profileService.updateIdentity('user-1', {
        displayName: 'Aarav Sharma',
        dateOfBirth: '2000-05-15',
        gender: Gender.MAN,
      });

      expect(result).toBeDefined();
      expect(result.displayName).toBe('Aarav Sharma');
      expect(result.age).toBeGreaterThanOrEqual(18);
      expect(result.visibility).toBe(ProfileVisibility.HIDDEN);
      expect(result.status).toBe(ProfileStatus.IN_PROGRESS);
      expect(result.completionScore).toBe(20);
    });
  });

  describe('updatePreferences', () => {
    beforeEach(async () => {
      await profileService.updateIdentity('user-1', {
        displayName: 'Aarav Sharma',
        dateOfBirth: '2000-05-15',
        gender: Gender.MAN,
      });
    });

    it('should reject invalid age ranges (minAge > maxAge)', async () => {
      await expect(
        profileService.updatePreferences('user-1', {
          preferredGenderMode: PreferredGenderMode.SELECTED,
          preferredGenders: [Gender.WOMAN],
          minAge: 35,
          maxAge: 25,
          relationshipIntent: RelationshipIntent.LONG_TERM,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should update preferences and advance completion to 40%', async () => {
      const result = await profileService.updatePreferences('user-1', {
        preferredGenderMode: PreferredGenderMode.SELECTED,
        preferredGenders: [Gender.WOMAN],
        minAge: 21,
        maxAge: 30,
        relationshipIntent: RelationshipIntent.LONG_TERM,
      });

      expect(result.preferences).toBeDefined();
      expect(result.completionScore).toBe(40);
    });
  });

  describe('updateInterests', () => {
    beforeEach(async () => {
      await profileService.updateIdentity('user-1', {
        displayName: 'Aarav Sharma',
        dateOfBirth: '2000-05-15',
        gender: Gender.MAN,
      });
      await profileService.updatePreferences('user-1', {
        preferredGenderMode: PreferredGenderMode.SELECTED,
        preferredGenders: [Gender.WOMAN],
        minAge: 21,
        maxAge: 30,
        relationshipIntent: RelationshipIntent.LONG_TERM,
      });
    });

    it('should save 3 valid interests and advance completion to 60%', async () => {
      const result = await profileService.updateInterests('user-1', {
        interestIds: ['valid-hiking', 'valid-music', 'valid-coffee'],
      });

      expect(result.interests.length).toBe(3);
      expect(result.completionScore).toBe(60);
    });
  });

  describe('Full Lifecycle to READY with Approved Photos and Visibility Guard', () => {
    beforeEach(async () => {
      await profileService.updateIdentity('user-1', {
        displayName: 'Aarav Sharma',
        dateOfBirth: '2000-05-15',
        gender: Gender.MAN,
      });
      await profileService.updatePreferences('user-1', {
        preferredGenderMode: PreferredGenderMode.SELECTED,
        preferredGenders: [Gender.WOMAN],
        minAge: 21,
        maxAge: 30,
        relationshipIntent: RelationshipIntent.LONG_TERM,
      });
      await profileService.updateInterests('user-1', {
        interestIds: ['valid-hiking', 'valid-music', 'valid-coffee'],
      });
      await profileService.updateAboutLocation('user-1', {
        bio: 'Software engineer who enjoys hiking, indie music and great coffee.',
        locationCity: 'Bengaluru',
        locationRegion: 'Karnataka',
      });
    });

    it('should be at 80% without approved photos', async () => {
      const result = await profileService.getMe('user-1');
      expect(result?.completionScore).toBe(80);
      expect(result?.status).toBe(ProfileStatus.IN_PROGRESS);
    });

    it('should reach 100% and READY status once at least one approved photo exists', async () => {
      const profile = await mockPrisma.datingProfile.findUnique({
        where: { userId: 'user-1' },
      });
      photoStore.set('p-1', {
        id: 'p-1',
        profileId: profile.id,
        status: PhotoStatus.APPROVED,
        position: 0,
        thumbnailKey: 'thumb-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await profileService.getMe('user-1');
      expect(result?.completionScore).toBe(100);
      expect(result?.status).toBe(ProfileStatus.READY);
    });

    it('should reject visibility toggle to VISIBLE if photos milestone is missing', async () => {
      await expect(
        profileService.updateVisibility('user-1', ProfileVisibility.VISIBLE),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getViewableProfile', () => {
    it('should return a safe viewable profile with approved photos and derived age', async () => {
      const profile = await profileService.updateIdentity('user-candidate', {
        displayName: 'Deepa',
        dateOfBirth: '1998-04-12',
        gender: Gender.WOMAN,
      });
      const stored = profileStore.get(profile.id);
      stored.visibility = ProfileVisibility.VISIBLE;
      profileStore.set(profile.id, stored);

      photoStore.set('photo-cand-1', {
        id: 'photo-cand-1',
        profileId: profile.id,
        status: PhotoStatus.APPROVED,
        position: 0,
        thumbnailKey: 'cand-thumb.webp',
        mediumKey: 'cand-med.webp',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const viewable = await profileService.getViewableProfile(
        'user-requester',
        profile.id,
      );

      expect(viewable.displayName).toBe('Deepa');
      expect(viewable.age).toBeGreaterThanOrEqual(25);
      expect(viewable.photos).toHaveLength(1);
      expect(viewable.photos[0].thumbnailUrl).toContain('cand-thumb.webp');
    });
  });
});
