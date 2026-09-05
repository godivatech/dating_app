import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import { TokenService } from '../src/auth/services/token.service';
import { STORAGE_SERVICE } from '../src/media/storage/storage.interface';
import {
  User,
  UserStatus,
  ProfileStatus,
  ProfileVisibility,
  Gender,
  PreferredGenderMode,
  RelationshipIntent,
  PhotoStatus,
  MatchStatus,
} from '@prisma/client';

describe('Chat & Messaging Domain (e2e)', () => {
  let app: INestApplication;
  let tokenService: TokenService;

  let authTokenUserA: string;
  let authTokenUserB: string;
  let authTokenUserC: string;

  const userA: User = {
    id: 'user-chat-e2e-a',
    phoneNumber: '+919876533331',
    phoneVerifiedAt: new Date(),
    status: UserStatus.ACTIVE,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastLoginAt: new Date(),
  };

  const userB: User = {
    id: 'user-chat-e2e-b',
    phoneNumber: '+919876533332',
    phoneVerifiedAt: new Date(),
    status: UserStatus.ACTIVE,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastLoginAt: new Date(),
  };

  const userC: User = {
    id: 'user-chat-e2e-c',
    phoneNumber: '+919876533333',
    phoneVerifiedAt: new Date(),
    status: UserStatus.ACTIVE,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastLoginAt: new Date(),
  };

  const profileA: any = {
    id: 'prof-chat-e2e-a',
    userId: userA.id,
    displayName: 'Alice Chat',
    dateOfBirth: new Date('2000-05-15T00:00:00.000Z'),
    gender: Gender.WOMAN,
    bio: 'Architect in Bengaluru.',
    locationCity: 'Bengaluru',
    locationRegion: 'Karnataka',
    locationCountry: 'IN',
    visibility: ProfileVisibility.VISIBLE,
    status: ProfileStatus.READY,
    preferences: {
      preferredGenderMode: PreferredGenderMode.SELECTED,
      preferredGenders: [Gender.MAN],
      minAge: 24,
      maxAge: 32,
      relationshipIntent: RelationshipIntent.LONG_TERM,
    },
    interests: [],
    photos: [
      {
        id: 'p-ca1',
        status: PhotoStatus.APPROVED,
        position: 0,
        thumbnailKey: 'ca.webp',
      },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const profileB: any = {
    id: 'prof-chat-e2e-b',
    userId: userB.id,
    displayName: 'Bob Chat',
    dateOfBirth: new Date('1998-08-20T00:00:00.000Z'),
    gender: Gender.MAN,
    bio: 'Engineer in Bengaluru.',
    locationCity: 'Bengaluru',
    locationRegion: 'Karnataka',
    locationCountry: 'IN',
    visibility: ProfileVisibility.VISIBLE,
    status: ProfileStatus.READY,
    preferences: {
      preferredGenderMode: PreferredGenderMode.SELECTED,
      preferredGenders: [Gender.WOMAN],
      minAge: 22,
      maxAge: 30,
      relationshipIntent: RelationshipIntent.LONG_TERM,
    },
    interests: [],
    photos: [
      {
        id: 'p-cb1',
        status: PhotoStatus.APPROVED,
        position: 0,
        thumbnailKey: 'cb.webp',
      },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const profileC: any = {
    id: 'prof-chat-e2e-c',
    userId: userC.id,
    displayName: 'Charlie Outsider',
    dateOfBirth: new Date('1999-01-01T00:00:00.000Z'),
    gender: Gender.MAN,
    visibility: ProfileVisibility.VISIBLE,
    status: ProfileStatus.READY,
    preferences: null,
    interests: [],
    photos: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const userMap = new Map<string, User>([
    [userA.id, userA],
    [userB.id, userB],
    [userC.id, userC],
  ]);

  const profileMap = new Map<string, any>([
    [profileA.id, profileA],
    [profileB.id, profileB],
    [profileC.id, profileC],
  ]);

  let matchState: any = {
    id: 'match-chat-e2e-1',
    user1Id: userA.id,
    user2Id: userB.id,
    status: MatchStatus.ACTIVE,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const conversationMap = new Map<string, any>();
  const messageMap = new Map<string, any>();
  const participantStateMap = new Map<string, any>();

  const mockPrismaService = {
    user: {
      findUnique: jest.fn().mockImplementation(({ where }) => {
        const u = userMap.get(where.id);
        if (!u) return Promise.resolve(null);
        const p = Array.from(profileMap.values()).find(
          (prof) => prof.userId === u.id,
        );
        return Promise.resolve({ ...u, profile: p || null });
      }),
      findMany: jest.fn().mockImplementation(({ where }) => {
        if (where?.id?.in) {
          const matched = where.id.in
            .map((id: string) => userMap.get(id))
            .filter(Boolean);
          return Promise.resolve(matched);
        }
        return Promise.resolve(Array.from(userMap.values()));
      }),
    },
    authSession: {
      findUnique: jest
        .fn()
        .mockResolvedValue({ id: 'session-1', revokedAt: null }),
    },
    datingProfile: {
      findUnique: jest.fn().mockImplementation(({ where }) => {
        let p: any = null;
        if (where.id) p = profileMap.get(where.id);
        else if (where.userId) {
          p = Array.from(profileMap.values()).find(
            (prof) => prof.userId === where.userId,
          );
        }
        if (!p) return Promise.resolve(null);
        const u = userMap.get(p.userId);
        return Promise.resolve({ ...p, user: u });
      }),
    },
    match: {
      findUnique: jest.fn().mockImplementation(({ where }) => {
        if (where.id === matchState.id) {
          return Promise.resolve({
            ...matchState,
            user1: { ...userA, profile: profileA },
            user2: { ...userB, profile: profileB },
          });
        }
        return Promise.resolve(null);
      }),
      findMany: jest.fn().mockImplementation(() => {
        return Promise.resolve([
          {
            ...matchState,
            user1: { ...userA, profile: profileA },
            user2: { ...userB, profile: profileB },
            conversation: Array.from(conversationMap.values())[0] || null,
          },
        ]);
      }),
    },
    conversation: {
      upsert: jest.fn().mockImplementation(({ where, create, update }) => {
        let existing = conversationMap.get(where.matchId);
        if (existing) {
          existing = { ...existing, ...update, updatedAt: new Date() };
          conversationMap.set(where.matchId, existing);
          return Promise.resolve({
            ...existing,
            participantStates: Array.from(participantStateMap.values()).filter(
              (ps) => ps.conversationId === existing.id,
            ),
            messages: Array.from(messageMap.values()).filter(
              (m) => m.conversationId === existing.id,
            ),
          });
        } else {
          const id = 'conv-chat-e2e-1';
          const created = {
            id,
            ...create,
            lastSequence: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          conversationMap.set(where.matchId, created);
          return Promise.resolve({
            ...created,
            participantStates: [],
            messages: [],
          });
        }
      }),
      findUnique: jest.fn().mockImplementation(({ where }) => {
        const conv = Array.from(conversationMap.values()).find(
          (c) => c.id === where.id,
        );
        if (!conv) return Promise.resolve(null);
        return Promise.resolve({
          ...conv,
          match: {
            ...matchState,
            user1: { ...userA, profile: profileA },
            user2: { ...userB, profile: profileB },
          },
          participantStates: Array.from(participantStateMap.values()).filter(
            (ps) => ps.conversationId === conv.id,
          ),
          messages: Array.from(messageMap.values()).filter(
            (m) => m.conversationId === conv.id,
          ),
        });
      }),
      update: jest.fn().mockImplementation(({ where, data }) => {
        const conv = Array.from(conversationMap.values()).find(
          (c) => c.id === where.id,
        );
        if (!conv) return Promise.resolve(null);
        let seq = conv.lastSequence || 0;
        if (data.lastSequence?.increment) {
          seq += data.lastSequence.increment;
        }
        const updated = {
          ...conv,
          ...data,
          lastSequence: seq,
          updatedAt: new Date(),
        };
        conversationMap.set(conv.matchId, updated);
        return Promise.resolve(updated);
      }),
    },
    conversationParticipantState: {
      findUnique: jest.fn().mockImplementation(({ where }) => {
        const key = `${where.conversationId_userId.conversationId}_${where.conversationId_userId.userId}`;
        return Promise.resolve(participantStateMap.get(key) || null);
      }),
      upsert: jest.fn().mockImplementation(({ where, create, update }) => {
        const key = `${where.conversationId_userId.conversationId}_${where.conversationId_userId.userId}`;
        const existing = participantStateMap.get(key);
        if (existing) {
          const updated = { ...existing, ...update };
          participantStateMap.set(key, updated);
          return Promise.resolve(updated);
        } else {
          const created = { id: `ps-${Math.random()}`, ...create };
          participantStateMap.set(key, created);
          return Promise.resolve(created);
        }
      }),
    },
    message: {
      findUnique: jest.fn().mockImplementation(({ where }) => {
        if (where.conversationId_clientMessageId) {
          const m = Array.from(messageMap.values()).find(
            (item) =>
              item.conversationId ===
                where.conversationId_clientMessageId.conversationId &&
              item.clientMessageId ===
                where.conversationId_clientMessageId.clientMessageId,
          );
          return Promise.resolve(m || null);
        }
        if (where.id) {
          return Promise.resolve(messageMap.get(where.id) || null);
        }
        return Promise.resolve(null);
      }),
      create: jest.fn().mockImplementation(({ data }) => {
        const id = `msg-${Date.now()}-${Math.random()}`;
        const created = {
          id,
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        messageMap.set(id, created);
        return Promise.resolve(created);
      }),
      findMany: jest.fn().mockImplementation(({ where }) => {
        const list = Array.from(messageMap.values()).filter(
          (m) => m.conversationId === where.conversationId,
        );
        return Promise.resolve(list);
      }),
      updateMany: jest.fn().mockImplementation(({ where, data }) => {
        let count = 0;
        for (const [id, msg] of messageMap.entries()) {
          if (
            msg.conversationId === where.conversationId &&
            msg.sequence <= where.sequence.lte &&
            msg.senderUserId !== where.senderUserId.not
          ) {
            messageMap.set(id, { ...msg, ...data });
            count++;
          }
        }
        return Promise.resolve({ count });
      }),
      count: jest.fn().mockResolvedValue(0),
    },
    block: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    $transaction: jest.fn().mockImplementation((callback) => {
      return callback(mockPrismaService);
    }),
  };

  const mockRedisService = {
    incrementWithWindow: jest.fn().mockResolvedValue({ current: 1 }),
  };

  const mockStorageService = {
    getPublicUrl: jest
      .fn()
      .mockImplementation((k) => `https://cdn.datingapp.com/${k}`),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrismaService)
      .overrideProvider(RedisService)
      .useValue(mockRedisService)
      .overrideProvider(STORAGE_SERVICE)
      .useValue(mockStorageService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );

    await app.init();

    tokenService = app.get(TokenService);
    const tokensA = await tokenService.generateTokens(userA.id, 'session-a');
    authTokenUserA = tokensA.accessToken;

    const tokensB = await tokenService.generateTokens(userB.id, 'session-b');
    authTokenUserB = tokensB.accessToken;

    const tokensC = await tokenService.generateTokens(userC.id, 'session-c');
    authTokenUserC = tokensC.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  let establishedConversationId: string;

  it('1. POST /api/v1/conversations/matches/:matchId - Opens or creates conversation for active match', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/conversations/matches/${matchState.id}`)
      .set('Authorization', `Bearer ${authTokenUserA}`)
      .expect(200);

    expect(res.body.id).toBeDefined();
    expect(res.body.matchId).toBe(matchState.id);
    expect(res.body.matchedProfile.displayName).toBe('Bob Chat');
    expect(res.body.isMatchActive).toBe(true);

    establishedConversationId = res.body.id;
  });

  it('2. POST /api/v1/conversations/:conversationId/messages - User A sends a message with monotonic sequence', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/conversations/${establishedConversationId}/messages`)
      .set('Authorization', `Bearer ${authTokenUserA}`)
      .send({
        clientMessageId: 'cli-chat-msg-1',
        body: 'Hello Bob! Excited to connect.',
      })
      .expect(200);

    expect(res.body.id).toBeDefined();
    expect(res.body.sequence).toBe(1);
    expect(res.body.body).toBe('Hello Bob! Excited to connect.');
    expect(res.body.deliveryStatus).toBe('SENT');
    expect(res.body.isMine).toBe(true);
  });

  it('3. POST /api/v1/conversations/:conversationId/messages - Idempotency: Retrying same clientMessageId returns same message', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/conversations/${establishedConversationId}/messages`)
      .set('Authorization', `Bearer ${authTokenUserA}`)
      .send({
        clientMessageId: 'cli-chat-msg-1',
        body: 'Hello Bob! Excited to connect.',
      })
      .expect(200);

    expect(res.body.sequence).toBe(1);
    expect(res.body.body).toBe('Hello Bob! Excited to connect.');
  });

  it('4. GET /api/v1/conversations/:conversationId/messages - User B retrieves message history', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/conversations/${establishedConversationId}/messages`)
      .set('Authorization', `Bearer ${authTokenUserB}`)
      .expect(200);

    expect(res.body.messages.length).toBe(1);
    expect(res.body.messages[0].sequence).toBe(1);
    expect(res.body.messages[0].body).toBe('Hello Bob! Excited to connect.');
    expect(res.body.messages[0].isMine).toBe(false);
  });

  it('5. POST /api/v1/conversations/:conversationId/read - User B marks messages read', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/conversations/${establishedConversationId}/read`)
      .set('Authorization', `Bearer ${authTokenUserB}`)
      .send({
        throughSequence: 1,
      })
      .expect(200);

    expect(res.body.throughSequence).toBe(1);
  });

  it('6. GET /api/v1/conversations/:conversationId/messages - Unauthorized User C receives 404', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/conversations/${establishedConversationId}/messages`)
      .set('Authorization', `Bearer ${authTokenUserC}`)
      .expect(404);
  });

  it('7. Safety Check: If match becomes UNMATCHED, message sending is rejected with 403 Forbidden', async () => {
    matchState = { ...matchState, status: MatchStatus.UNMATCHED };

    await request(app.getHttpServer())
      .post(`/api/v1/conversations/${establishedConversationId}/messages`)
      .set('Authorization', `Bearer ${authTokenUserA}`)
      .send({
        clientMessageId: 'cli-chat-msg-blocked',
        body: 'Are you still there?',
      })
      .expect(403);
  });
});
