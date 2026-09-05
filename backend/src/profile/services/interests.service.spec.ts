import { InterestsService } from './interests.service';
import { InterestStatus } from '@prisma/client';

describe('InterestsService', () => {
  let interestsService: InterestsService;
  let mockPrisma: any;

  const interestStore = new Map<string, any>();

  beforeEach(() => {
    interestStore.clear();

    mockPrisma = {
      interest: {
        count: jest
          .fn()
          .mockImplementation(() => Promise.resolve(interestStore.size)),
        upsert: jest.fn().mockImplementation(({ where, create }) => {
          interestStore.set(where.id, create);
          return Promise.resolve(create);
        }),
        findMany: jest.fn().mockImplementation(({ where }) => {
          let list = Array.from(interestStore.values());
          if (where?.status) {
            list = list.filter((i) => i.status === where.status);
          }
          if (where?.id?.in) {
            list = list.filter((i) => where.id.in.includes(i.id));
          }
          return Promise.resolve(list);
        }),
      },
    };

    interestsService = new InterestsService(mockPrisma);
  });

  it('should seed default interests if database is empty on init', async () => {
    await interestsService.onModuleInit();
    expect(interestStore.size).toBeGreaterThan(15);
    expect(interestStore.has('outdoors-hiking')).toBe(true);
    expect(interestStore.has('music-indie')).toBe(true);
  });

  it('should validate active interest IDs correctly', async () => {
    await interestsService.onModuleInit();

    const validResult = await interestsService.validateInterestIds([
      'outdoors-hiking',
      'music-indie',
      'food-coffee',
    ]);
    expect(validResult.isValid).toBe(true);
    expect(validResult.invalidIds.length).toBe(0);

    const invalidResult = await interestsService.validateInterestIds([
      'outdoors-hiking',
      'fake-interest-id',
    ]);
    expect(invalidResult.isValid).toBe(false);
    expect(invalidResult.invalidIds).toContain('fake-interest-id');
  });

  it('should reject inactive interests', async () => {
    await interestsService.onModuleInit();
    const hiking = interestStore.get('outdoors-hiking');
    if (hiking) hiking.status = InterestStatus.INACTIVE;

    const result = await interestsService.validateInterestIds([
      'outdoors-hiking',
    ]);
    expect(result.isValid).toBe(false);
    expect(result.invalidIds).toContain('outdoors-hiking');
  });
});
