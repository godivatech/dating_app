import { Injectable, Inject, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { StorageService } from '../../media/storage/storage.interface';
import { STORAGE_SERVICE } from '../../media/storage/storage.interface';
import { DiscoveryPaginationService } from '../../discovery/services/discovery-pagination.service';
import { calculateAge } from '../../profile/utils/age.util';
import { ConversationsQueryDto } from '../dto/conversations-query.dto';
import {
  ConversationsListResponse,
  SafeConversationSummary,
  SafeMessage,
  DiscoveryCandidate,
  SafeProfilePhoto,
  MessageType,
  MessageDeliveryStatus,
} from '../../../../shared/src/types';
import { MatchStatus as PrismaMatchStatus, PhotoStatus } from '@prisma/client';

@Injectable()
export class ConversationsService {
  private readonly logger = new Logger(ConversationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly paginationService: DiscoveryPaginationService,
    @Inject(STORAGE_SERVICE)
    private readonly storageService: StorageService,
  ) {}

  /**
   * Finds or lazily creates a 1:1 conversation for a verified match.
   */
  async getOrCreateConversation(
    matchId: string,
    userId: string,
  ): Promise<SafeConversationSummary> {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: {
        user1: {
          include: {
            profile: {
              include: {
                preferences: true,
                interests: { include: { interest: true } },
                photos: {
                  where: { status: PhotoStatus.APPROVED },
                  orderBy: { position: 'asc' },
                },
              },
            },
          },
        },
        user2: {
          include: {
            profile: {
              include: {
                preferences: true,
                interests: { include: { interest: true } },
                photos: {
                  where: { status: PhotoStatus.APPROVED },
                  orderBy: { position: 'asc' },
                },
              },
            },
          },
        },
      },
    });

    if (!match || (match.user1Id !== userId && match.user2Id !== userId)) {
      throw new NotFoundException('Match not found.');
    }

    // Atomically upsert Conversation
    const conversation = await this.prisma.conversation.upsert({
      where: { matchId },
      create: { matchId },
      update: {},
      include: {
        participantStates: true,
        messages: {
          orderBy: { sequence: 'desc' },
          take: 1,
        },
      },
    });

    // Ensure participant states exist for both users
    await this.ensureParticipantStates(
      conversation.id,
      match.user1Id,
      match.user2Id,
    );

    const otherUser = match.user1Id === userId ? match.user2 : match.user1;
    if (!otherUser?.profile) {
      throw new NotFoundException('Matched profile not found.');
    }

    const matchedProfile = this.mapToSafeCandidate(otherUser.profile);
    const lastMsg = conversation.messages[0]
      ? this.mapToSafeMessage(conversation.messages[0], userId)
      : null;

    const userState = conversation.participantStates.find(
      (ps) => ps.userId === userId,
    );
    const lastReadSequence = userState?.lastReadSequence || 0;

    const unreadCount = await this.prisma.message.count({
      where: {
        conversationId: conversation.id,
        sequence: { gt: lastReadSequence },
        senderUserId: { not: userId },
      },
    });

    return {
      id: conversation.id,
      matchId: match.id,
      matchedProfile,
      lastMessage: lastMsg,
      unreadCount,
      isMatchActive: match.status === PrismaMatchStatus.ACTIVE,
      updatedAt: (conversation.updatedAt
        ? new Date(conversation.updatedAt)
        : new Date()
      ).toISOString(),
    };
  }

  /**
   * Retrieves paginated conversations for active matches of the requesting user.
   */
  async listConversations(
    userId: string,
    query: ConversationsQueryDto,
  ): Promise<ConversationsListResponse> {
    const limit = query.limit || 20;
    const { offset } = this.paginationService.decodeCursor(query.cursor);

    // Find all matches for user
    const matches = await this.prisma.match.findMany({
      where: {
        OR: [{ user1Id: userId }, { user2Id: userId }],
      },
      include: {
        conversation: {
          include: {
            participantStates: true,
            messages: {
              orderBy: { sequence: 'desc' },
              take: 1,
            },
          },
        },
        user1: {
          include: {
            profile: {
              include: {
                preferences: true,
                interests: { include: { interest: true } },
                photos: {
                  where: { status: PhotoStatus.APPROVED },
                  orderBy: { position: 'asc' },
                },
              },
            },
          },
        },
        user2: {
          include: {
            profile: {
              include: {
                preferences: true,
                interests: { include: { interest: true } },
                photos: {
                  where: { status: PhotoStatus.APPROVED },
                  orderBy: { position: 'asc' },
                },
              },
            },
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
      skip: offset,
      take: limit + 1,
    });

    const hasMore = matches.length > limit;
    const items = hasMore ? matches.slice(0, limit) : matches;
    const nextCursor = hasMore
      ? this.paginationService.createCursor(offset + limit)
      : null;

    const conversations: SafeConversationSummary[] = [];

    for (const m of items) {
      const otherUser = m.user1Id === userId ? m.user2 : m.user1;
      if (!otherUser?.profile) continue;

      let conv = m.conversation;
      if (!conv) {
        // Lazily create conversation if match exists
        conv = await this.prisma.conversation.create({
          data: { matchId: m.id },
          include: {
            participantStates: true,
            messages: {
              orderBy: { sequence: 'desc' },
              take: 1,
            },
          },
        });
        await this.ensureParticipantStates(conv.id, m.user1Id, m.user2Id);
      }

      const matchedProfile = this.mapToSafeCandidate(otherUser.profile);
      const lastMsg =
        conv.messages && conv.messages[0]
          ? this.mapToSafeMessage(conv.messages[0], userId)
          : null;

      const userState = (conv.participantStates || []).find(
        (ps) => ps.userId === userId,
      );
      const lastReadSequence = userState?.lastReadSequence || 0;

      const unreadCount = await this.prisma.message.count({
        where: {
          conversationId: conv.id,
          sequence: { gt: lastReadSequence },
          senderUserId: { not: userId },
        },
      });

      conversations.push({
        id: conv.id,
        matchId: m.id,
        matchedProfile,
        lastMessage: lastMsg,
        unreadCount,
        isMatchActive: m.status === PrismaMatchStatus.ACTIVE,
        updatedAt: (conv.updatedAt
          ? new Date(conv.updatedAt)
          : new Date()
        ).toISOString(),
      });
    }

    return {
      conversations,
      nextCursor,
      hasMore,
    };
  }

  /**
   * Retrieves conversation summary by conversation ID.
   */
  async getConversationDetail(
    conversationId: string,
    userId: string,
  ): Promise<SafeConversationSummary> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        match: {
          include: {
            user1: {
              include: {
                profile: {
                  include: {
                    preferences: true,
                    interests: { include: { interest: true } },
                    photos: {
                      where: { status: PhotoStatus.APPROVED },
                      orderBy: { position: 'asc' },
                    },
                  },
                },
              },
            },
            user2: {
              include: {
                profile: {
                  include: {
                    preferences: true,
                    interests: { include: { interest: true } },
                    photos: {
                      where: { status: PhotoStatus.APPROVED },
                      orderBy: { position: 'asc' },
                    },
                  },
                },
              },
            },
          },
        },
        participantStates: true,
        messages: {
          orderBy: { sequence: 'desc' },
          take: 1,
        },
      },
    });

    if (
      !conversation ||
      (conversation.match.user1Id !== userId &&
        conversation.match.user2Id !== userId)
    ) {
      throw new NotFoundException('Conversation not found.');
    }

    const match = conversation.match;
    const otherUser = match.user1Id === userId ? match.user2 : match.user1;
    if (!otherUser?.profile) {
      throw new NotFoundException('Matched profile not found.');
    }

    const matchedProfile = this.mapToSafeCandidate(otherUser.profile);
    const lastMsg = conversation.messages[0]
      ? this.mapToSafeMessage(conversation.messages[0], userId)
      : null;

    const userState = conversation.participantStates.find(
      (ps) => ps.userId === userId,
    );
    const lastReadSequence = userState?.lastReadSequence || 0;

    const unreadCount = await this.prisma.message.count({
      where: {
        conversationId: conversation.id,
        sequence: { gt: lastReadSequence },
        senderUserId: { not: userId },
      },
    });

    return {
      id: conversation.id,
      matchId: match.id,
      matchedProfile,
      lastMessage: lastMsg,
      unreadCount,
      isMatchActive: match.status === PrismaMatchStatus.ACTIVE,
      updatedAt: (conversation.updatedAt
        ? new Date(conversation.updatedAt)
        : new Date()
      ).toISOString(),
    };
  }

  private async ensureParticipantStates(
    conversationId: string,
    user1Id: string,
    user2Id: string,
  ): Promise<void> {
    await Promise.all([
      this.prisma.conversationParticipantState.upsert({
        where: {
          conversationId_userId: { conversationId, userId: user1Id },
        },
        create: { conversationId, userId: user1Id },
        update: {},
      }),
      this.prisma.conversationParticipantState.upsert({
        where: {
          conversationId_userId: { conversationId, userId: user2Id },
        },
        create: { conversationId, userId: user2Id },
        update: {},
      }),
    ]);
  }

  private mapToSafeMessage(msg: any, requestingUserId: string): SafeMessage {
    return {
      id: msg.id,
      conversationId: msg.conversationId,
      senderUserId: msg.senderUserId,
      clientMessageId: msg.clientMessageId,
      sequence: msg.sequence,
      body: msg.body,
      type: msg.type as MessageType,
      deliveryStatus: msg.deliveryStatus as MessageDeliveryStatus,
      createdAt: (msg.createdAt
        ? new Date(msg.createdAt)
        : new Date()
      ).toISOString(),
      isMine: msg.senderUserId === requestingUserId,
    };
  }

  private mapToSafeCandidate(candidate: any): DiscoveryCandidate {
    const age = calculateAge(candidate.dateOfBirth);
    const photos: SafeProfilePhoto[] = (candidate.photos || []).map(
      (photo: any) => {
        const isApproved = photo.status === PhotoStatus.APPROVED;
        const fallbackUrl =
          isApproved && photo.objectKey && photo.objectKey !== 'pending'
            ? this.storageService.getPublicUrl(photo.objectKey)
            : null;

        return {
          id: photo.id,
          profileId: photo.profileId,
          status: photo.status,
          position: photo.position,
          isPrimary:
            photo.position === 0 && isApproved,
          thumbnailUrl:
            isApproved && photo.thumbnailKey
              ? this.storageService.getPublicUrl(photo.thumbnailKey)
              : fallbackUrl,
          mediumUrl:
            isApproved && photo.mediumKey
              ? this.storageService.getPublicUrl(photo.mediumKey)
              : fallbackUrl,
          largeUrl:
            isApproved && photo.largeKey
              ? this.storageService.getPublicUrl(photo.largeKey)
              : fallbackUrl,
          width: photo.width,
          height: photo.height,
          createdAt: (photo.createdAt
            ? new Date(photo.createdAt)
            : new Date()
          ).toISOString(),
          updatedAt: (photo.updatedAt
            ? new Date(photo.updatedAt)
            : new Date()
          ).toISOString(),
        };
      },
    );

    const interests = (candidate.interests || []).map((pi: any) => ({
      id: pi.interest?.id || pi.interestId,
      name: pi.interest?.name || 'Interest',
      category: pi.interest?.category || 'General',
      status: pi.interest?.status || 'ACTIVE',
    }));

    return {
      profileId: candidate.id,
      userId: candidate.userId,
      displayName: candidate.displayName,
      age,
      gender: candidate.gender,
      bio: candidate.bio,
      locationCity: candidate.locationCity,
      locationRegion: candidate.locationRegion,
      locationCountry: candidate.locationCountry,
      relationshipIntent: candidate.preferences?.relationshipIntent || null,
      interests,
      photos,
      algorithmVersion: 'baseline-v1',
    };
  }
}
