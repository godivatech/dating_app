import { DiscoveryPaginationService } from './discovery-pagination.service';
import { BadRequestException } from '@nestjs/common';

describe('DiscoveryPaginationService', () => {
  let service: DiscoveryPaginationService;

  beforeEach(() => {
    service = new DiscoveryPaginationService();
  });

  it('should generate and decode valid cursor tokens correctly', () => {
    const cursor = service.createCursor(20);
    expect(typeof cursor).toBe('string');

    const decoded = service.decodeCursor(cursor);
    expect(decoded.offset).toBe(20);
    expect(decoded.timestamp).toBeLessThanOrEqual(Date.now());
  });

  it('should return offset 0 when cursor is undefined', () => {
    const decoded = service.decodeCursor(undefined);
    expect(decoded.offset).toBe(0);
  });

  it('should throw BadRequestException on tampered cursor token', () => {
    const cursor = service.createCursor(10);
    const tampered = cursor.slice(0, -4) + 'abcd';

    expect(() => service.decodeCursor(tampered)).toThrow(BadRequestException);
  });
});
