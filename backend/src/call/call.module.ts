import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { CallService } from './services/call.service';
import { AgoraTokenService } from './services/agora-token.service';
import { CallGateway } from './gateways/call.gateway';
import { CallController } from './call.controller';

@Module({
  imports: [
    PrismaModule,
    RedisModule,
    AuthModule,
    NotificationsModule,
  ],
  controllers: [CallController],
  providers: [
    CallService,
    AgoraTokenService,
    CallGateway,
  ],
  exports: [
    CallService,
    AgoraTokenService,
  ],
})
export class CallModule {}
