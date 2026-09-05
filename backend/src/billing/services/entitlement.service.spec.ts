import { EntitlementService } from './entitlement.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EntitlementKey, EntitlementSource } from '@prisma/client';

describe('EntitlementService', () => {
  let service: EntitlementService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      userEntitlement: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        upsert: jest.fn(),
        updateMany: jest.fn(),
      },
    };

    service = new EntitlementService(mockPrisma as PrismaService);
  });

  it('should return true if active unexpired entitlement exists', async () => {
    mockPrisma.userEntitlement.findFirst.mockResolvedValue({
      id: 'ent-1',
      userId: 'user-1',
      entitlementKey: EntitlementKey.UNLIMITED_LIKES,
      isActive: true,
      expiresAt: new Date(Date.now() + 100000),
    });

    const result = await service.hasEntitlement('user-1', EntitlementKey.UNLIMITED_LIKES);
    expect(result).toBe(true);
  });

  it('should return false if entitlement is inactive or not found', async () => {
    mockPrisma.userEntitlement.findFirst.mockResolvedValue(null);

    const result = await service.hasEntitlement('user-1', EntitlementKey.SEE_LIKES);
    expect(result).toBe(false);
  });

  it('should grant entitlement idempotently via upsert', async () => {
    mockPrisma.userEntitlement.upsert.mockResolvedValue({
      id: 'ent-1',
      userId: 'user-1',
      entitlementKey: EntitlementKey.REWIND_PASS,
      source: EntitlementSource.SUBSCRIPTION,
      sourceReferenceId: 'sub-1',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const res = await service.grantEntitlement(
      'user-1',
      EntitlementKey.REWIND_PASS,
      EntitlementSource.SUBSCRIPTION,
      'sub-1',
    );

    expect(res.id).toBe('ent-1');
    expect(mockPrisma.userEntitlement.upsert).toHaveBeenCalled();
  });

  it('should revoke entitlements for source', async () => {
    mockPrisma.userEntitlement.updateMany.mockResolvedValue({ count: 2 });

    const count = await service.revokeEntitlementsForSource(
      EntitlementSource.SUBSCRIPTION,
      'sub-1',
    );

    expect(count).toBe(2);
    expect(mockPrisma.userEntitlement.updateMany).toHaveBeenCalledWith({
      where: { source: EntitlementSource.SUBSCRIPTION, sourceReferenceId: 'sub-1' },
      data: { isActive: false },
    });
  });
});
