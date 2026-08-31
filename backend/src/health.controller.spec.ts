import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('GET /health should return status ok', () => {
    const result = controller.check();

    expect(result.status).toBe('ok');
    expect(result.timestamp).toBeDefined();
    // Should be a valid ISO date string
    expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
  });
});
