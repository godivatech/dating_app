import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { AuthModule } from '../auth/auth.module';
import { MediaModule } from '../media/media.module';
import { SafetyModule } from '../safety/safety.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { DiscoveryPaginationService } from '../discovery/services/discovery-pagination.service';
import { ConversationsController } from './conversations.controller';
import { ConversationsService } from './services/conversations.service';
import { MessagesService } from './services/messages.service';
import { ChatGateway } from './gateways/chat.gateway';

@Module({
  imports: [
    PrismaModule,
    RedisModule,
    AuthModule,
    MediaModule,
    SafetyModule,
    NotificationsModule,
  ],
  controllers: [ConversationsController],
  providers: [
    DiscoveryPaginationService,
    ConversationsService,
    MessagesService,
    ChatGateway,
  ],
  exports: [ConversationsService, MessagesService, ChatGateway],
})
export class ChatModule {}
