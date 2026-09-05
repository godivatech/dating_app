import { ConversationsService } from './conversations.service';
import { PrismaService } from '../../prisma/prisma.service';
import { DiscoveryPaginationService } from '../../discovery/services/discovery-pagination.service';
import { StorageService } from '../../media/storage/storage.interface';
import { MatchStatus, Gender, PhotoStatus } from '@prisma/client';
import { NotFoundException } from '@nestjs/common';

describe('ConversationsService', () => {
  let service: ConversationsService;
  let mockPrisma: any;
  let paginationService: DiscoveryPaginationService;
  let mockStorage: any;

  const userA = {
    id: 'user-a',
    profile: {
      id: 'prof-a',
      displayName: 'Alice',
      dateOfBirth: new Date('2000-01-01T00:00:00.000Z'),
      gender: Gender.WOMAN,
      photos: [
        {
          id: 'pa',
          status: PhotoStatus.APPROVED,
          position: 0,
          thumbnailKey: 'a.webp',
        },
      ],
      interests: [],
    },
  };

  const userB = {
    id: 'user-b',
    profile: {
      id: 'prof-b',
      displayName: 'Bob',
      dateOfBirth: new Date('1998-01-01T00:00:00.000Z'),
      gender: Gender.MAN,
      photos: [
        {
          id: 'pb',
          status: PhotoStatus.APPROVED,
          position: 0,
          thumbnailKey: 'b.webp',
        },
      ],
      interests: [],
    },
  };

  const matchRecord = {
    id: 'match-1',
    user1Id: 'user-a',
    user2Id: 'user-b',
    user1: userA,
    user2: userB,
    status: MatchStatus.ACTIVE,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const convRecord = {
    id: 'conv-1',
    matchId: 'match-1',
    lastSequence: 1,
    lastMessageAt: new Date(),
    lastMessagePreview: 'Hey there!',
    createdAt: new Date(),
    updatedAt: new Date(),
    match: matchRecord,
    participantStates: [
      { userId: 'user-a', lastReadSequence: 1 },
      { userId: 'user-b', lastReadSequence: 0 },
    ],
    messages: [
      {
        id: 'msg-1',
        conversationId: 'conv-1',
        senderUserId: 'user-a',
        clientMessageId: 'cli-1',
        sequence: 1,
        body: 'Hey there!',
        type: 'TEXT',
        deliveryStatus: 'SENT',
        createdAt: new Date(),
      },
    ],
  };

  beforeEach(() => {
    mockPrisma = {
      match: {
        findUnique: jest.fn().mockResolvedValue(matchRecord),
        findMany: jest.fn().mockResolvedValue([
          {
            ...matchRecord,
            conversation: convRecord,
          },
        ]),
      },
      conversation: {
        findUnique: jest.fn().mockResolvedValue(convRecord),
        upsert: jest.fn().mockResolvedValue(convRecord),
        create: jest.fn().mockResolvedValue(convRecord),
      },
      conversationParticipantState: {
        upsert: jest.fn().mockResolvedValue({}),
      },
      message: {
        count: jest.fn().mockResolvedValue(0),
      },
    };

    paginationService = new DiscoveryPaginationService();
    mockStorage = {
      getPublicUrl: jest.fn().mockImplementation((k) => `https://cdn/${k}`),
    };

    service = new ConversationsService(
      mockPrisma as PrismaService,
      paginationService,
      mockStorage as StorageService,
    );
  });

  it('should get or create a conversation for verified match', async () => {
    const res = await service.getOrCreateConversation('match-1', 'user-a');

    expect(res.id).toBe('conv-1');
    expect(res.matchId).toBe('match-1');
    expect(res.matchedProfile.displayName).toBe('Bob');
    expect(res.lastMessage?.body).toBe('Hey there!');
    expect(res.lastMessage?.isMine).toBe(true);
  });

  it('should throw NotFoundException if requesting user is not a participant', async () => {
    await expect(
      service.getOrCreateConversation('match-1', 'unauthorized-user'),
    ).rejects.toThrow(NotFoundException);
  });

  it('should list conversations with unread counts and latest messages', async () => {
    mockPrisma.message.count.mockResolvedValue(2);

    const res = await service.listConversations('user-b', { limit: 20 });

    expect(res.conversations.length).toBe(1);
    expect(res.conversations[0].id).toBe('conv-1');
    expect(res.conversations[0].matchedProfile.displayName).toBe('Alice');
    expect(res.conversations[0].unreadCount).toBe(2);
  });

  it('should get conversation detail for participant', async () => {
    const res = await service.getConversationDetail('conv-1', 'user-a');

    expect(res.id).toBe('conv-1');
    expect(res.matchedProfile.displayName).toBe('Bob');
  });
});
