import { Controller, Get } from '@nestjs/common';

/**
 * Health check controller.
 *
 * Provides a simple endpoint for infrastructure health verification.
 * Used by:
 *   - Load balancers
 *   - Container orchestration (Docker, Kubernetes)
 *   - Monitoring systems
 *   - CI/CD smoke tests
 *
 * Route: GET /api/v1/health
 *
 * Future phases may extend this with:
 *   - Database connectivity check
 *   - Redis connectivity check
 *   - Dependency health checks
 */
@Controller('health')
export class HealthController {
  @Get()
  check(): { status: string; timestamp: string } {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
