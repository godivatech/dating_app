import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ConversationsService } from './services/conversations.service';
import { MessagesService } from './services/messages.service';
import { ConversationsQueryDto } from './dto/conversations-query.dto';
import { MessagesQueryDto } from './dto/messages-query.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { ReadReceiptDto } from './dto/read-receipt.dto';
import {
  ConversationsListResponse,
  SafeConversationSummary,
  MessagesListResponse,
  SafeMessage,
} from '../../../shared/src/types';

@Controller('conversations')
@UseGuards(JwtAuthGuard)
export class ConversationsController {
  constructor(
    private readonly conversationsService: ConversationsService,
    private readonly messagesService: MessagesService,
  ) {}

  /**
   * Retrieves paginated conversations for the requesting user.
   */
  @Get()
  async listConversations(
    @Req() req: any,
    @Query() query: ConversationsQueryDto,
  ): Promise<ConversationsListResponse> {
    const userId = req.user.userId;
    return this.conversationsService.listConversations(userId, query);
  }

  /**
   * Finds or lazily creates a conversation for a match.
   */
  @Post('matches/:matchId')
  @HttpCode(HttpStatus.OK)
  async getOrCreateConversation(
    @Req() req: any,
    @Param('matchId') matchId: string,
  ): Promise<SafeConversationSummary> {
    const userId = req.user.userId;
    return this.conversationsService.getOrCreateConversation(matchId, userId);
  }

  /**
   * Retrieves single conversation summary.
   */
  @Get(':conversationId')
  async getConversationDetail(
    @Req() req: any,
    @Param('conversationId') conversationId: string,
  ): Promise<SafeConversationSummary> {
    const userId = req.user.userId;
    return this.conversationsService.getConversationDetail(
      conversationId,
      userId,
    );
  }

  /**
   * Retrieves paginated message history for a conversation.
   */
  @Get(':conversationId/messages')
  async getMessages(
    @Req() req: any,
    @Param('conversationId') conversationId: string,
    @Query() query: MessagesQueryDto,
  ): Promise<MessagesListResponse> {
    const userId = req.user.userId;
    return this.messagesService.getMessagesHistory(
      userId,
      conversationId,
      query,
    );
  }

  /**
   * Sends a message via REST fallback.
   */
  @Post(':conversationId/messages')
  @HttpCode(HttpStatus.OK)
  async sendMessage(
    @Req() req: any,
    @Param('conversationId') conversationId: string,
    @Body() dto: SendMessageDto,
  ): Promise<SafeMessage> {
    const userId = req.user.userId;
    const { message } = await this.messagesService.sendMessage(
      userId,
      conversationId,
      dto,
    );
    return message;
  }

  /**
   * Records read receipt for messages up to throughSequence.
   */
  @Post(':conversationId/read')
  @HttpCode(HttpStatus.OK)
  async markRead(
    @Req() req: any,
    @Param('conversationId') conversationId: string,
    @Body() dto: ReadReceiptDto,
  ): Promise<{ throughSequence: number }> {
    const userId = req.user.userId;
    const { throughSequence } = await this.messagesService.markMessagesRead(
      userId,
      conversationId,
      dto.throughSequence,
    );
    return { throughSequence };
  }
}
