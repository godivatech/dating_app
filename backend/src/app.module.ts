import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';

/**
 * Root application module — Phase 1.
 *
 * Only the health check is wired here for Phase 1.
 * Future domain modules (auth, users, profiles, etc.) will be
 * imported here as they are implemented in subsequent phases.
 */
@Module({
  imports: [],
  controllers: [HealthController],
  providers: [],
})
export class AppModule {}
