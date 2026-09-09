import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { HealthController } from './health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { SmsModule } from './sms/sms.module';
import { AuthModule } from './auth/auth.module';
import { ProfileModule } from './profile/profile.module';
import { MediaModule } from './media/media.module';
import { DiscoveryModule } from './discovery/discovery.module';
import { MatchingModule } from './matching/matching.module';
import { ChatModule } from './chat/chat.module';
import { SafetyModule } from './safety/safety.module';
import { NotificationsModule } from './notifications/notifications.module';
import { BillingModule } from './billing/billing.module';
import { CallModule } from './call/call.module';
import { AdminModule } from './admin/admin.module';

/**
 * Root application module — Phase 12.
 *
 * Configured with ConfigModule, ScheduleModule, PrismaModule, RedisModule,
 * SmsModule, AuthModule, ProfileModule, MediaModule, DiscoveryModule, MatchingModule, ChatModule, SafetyModule, NotificationsModule, BillingModule, CallModule, and AdminModule.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.development'],
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    RedisModule,
    SmsModule,
    AuthModule,
    ProfileModule,
    MediaModule,
    DiscoveryModule,
    MatchingModule,
    ChatModule,
    SafetyModule,
    NotificationsModule,
    BillingModule,
    CallModule,
    AdminModule,
  ],
  controllers: [HealthController],
  providers: [],
})
export class AppModule {}
