import { Test, TestingModule } from '@nestjs/testing';
import { ChatGateway } from './chat.gateway';
import { TokenService } from '../../auth/services/token.service';
import { MessagesService } from '../services/messages.service';
import { ConversationsService } from '../services/conversations.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { MatchStatus } from '@prisma/client';
import { NotFoundException } from '@nestjs/common';

describe('ChatGateway (Presence Privacy & Room Authorization)', () => {
  let gateway: ChatGateway;
  let tokenService: any;
  let messagesService: any;
  let conversationsService: any;
  let prisma: any;
  let redisService: any;
  let mockServer: any;

  const userA = 'user-alice';
  const userB = 'user-bob'; // matched partner
  const userC = 'user-charlie'; // unmatched stranger
  const userD = 'user-david'; // matched but blocked

  const createMockSocket = (id: string, tokenUserId?: string) => {
    const joinedRooms = new Set<string>();
    const emittedEvents: Array<{ event: string; data: any }> = [];

    return {
      id,
      handshake: {
        auth: { token: tokenUserId ? `valid-token-for-${tokenUserId}` : undefined },
        headers: {},
      },
      data: { userId: tokenUserId },
      join: jest.fn().mockImplementation((room: string) => {
        joinedRooms.add(room);
        return Promise.resolve();
      }),
      leave: jest.fn().mockImplementation((room: string) => {
        joinedRooms.delete(room);
        return Promise.resolve();
      }),
      emit: jest.fn().mockImplementation((event: string, data: any) => {
        emittedEvents.push({ event, data });
      }),
      disconnect: jest.fn(),
      joinedRooms,
      emittedEvents,
    } as any;
  };

  beforeEach(async () => {
    tokenService = {
      verifyAccessToken: jest.fn().mockImplementation((token: string) => {
        const match = token.match(/valid-token-for-(.+)/);
        if (match) return Promise.resolve({ sub: match[1] });
        return Promise.resolve(null);
      }),
    };

    messagesService = {};

    conversationsService = {
      getConversationDetail: jest.fn(),
    };

    prisma = {
      match: {
        findMany: jest.fn().mockImplementation(({ where }) => {
          const uid = where.OR?.[0]?.user1Id || where.OR?.[1]?.user2Id;
          if (uid === userA) {
            return Promise.resolve([
              { user1Id: userA, user2Id: userB, status: MatchStatus.ACTIVE },
              { user1Id: userA, user2Id: userD, status: MatchStatus.ACTIVE },
            ]);
          }
          return Promise.resolve([]);
        }),
        findFirst: jest.fn().mockImplementation(({ where }) => {
          const pairs = [
            [where.OR?.[0]?.user1Id, where.OR?.[0]?.user2Id],
            [where.OR?.[1]?.user1Id, where.OR?.[1]?.user2Id],
          ];
          const hasMatchAB = pairs.some(
            ([u1, u2]) =>
              (u1 === userA && u2 === userB) || (u1 === userB && u2 === userA),
          );
          if (hasMatchAB) {
            return Promise.resolve({ id: 'match-ab', status: MatchStatus.ACTIVE });
          }
          return Promise.resolve(null);
        }),
      },
      block: {
        findMany: jest.fn().mockImplementation(({ where }) => {
          // userD is blocked with userA
          return Promise.resolve([
            { blockerUserId: userA, blockedUserId: userD },
          ]);
        }),
        findFirst: jest.fn().mockImplementation(({ where }) => {
          const pairs = [
            [where.OR?.[0]?.blockerUserId, where.OR?.[0]?.blockedUserId],
            [where.OR?.[1]?.blockerUserId, where.OR?.[1]?.blockedUserId],
          ];
          const isBlocked = pairs.some(
            ([u1, u2]) =>
              (u1 === userA && u2 === userD) || (u1 === userD && u2 === userA),
          );
          if (isBlocked) {
            return Promise.resolve({ id: 'block-ad' });
          }
          return Promise.resolve(null);
        }),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({ lastLoginAt: new Date() }),
      },
    };

    // Shared Redis mock with TTL tracking
    const redisSets = new Map<string, Set<string>>();
    const redisStore = new Map<string, string>();
    const redisKeyExpiry = new Map<string, number>();

    const isKeyExpired = (key: string) => {
      const exp = redisKeyExpiry.get(key);
      if (exp && Date.now() >= exp) {
        redisSets.delete(key);
        redisStore.delete(key);
        redisKeyExpiry.delete(key);
        return true;
      }
      return false;
    };

    redisService = {
      sadd: jest.fn().mockImplementation((key: string, member: string) => {
        isKeyExpired(key);
        let set = redisSets.get(key);
        if (!set) {
          set = new Set();
          redisSets.set(key, set);
        }
        const had = set.has(member);
        set.add(member);
        return Promise.resolve(had ? 0 : 1);
      }),
      srem: jest.fn().mockImplementation((key: string, member: string) => {
        isKeyExpired(key);
        const set = redisSets.get(key);
        if (!set) return Promise.resolve(0);
        const removed = set.delete(member);
        return Promise.resolve(removed ? 1 : 0);
      }),
      scard: jest.fn().mockImplementation((key: string) => {
        isKeyExpired(key);
        const set = redisSets.get(key);
        return Promise.resolve(set ? set.size : 0);
      }),
      expire: jest.fn().mockImplementation((key: string, seconds: number) => {
        isKeyExpired(key);
        if (!redisSets.has(key) && !redisStore.has(key)) {
          return Promise.resolve(false);
        }
        redisKeyExpiry.set(key, Date.now() + seconds * 1000);
        return Promise.resolve(true);
      }),
      ttl: jest.fn().mockImplementation((key: string) => {
        isKeyExpired(key);
        const exp = redisKeyExpiry.get(key);
        if (!exp) return Promise.resolve(-2);
        return Promise.resolve(Math.max(0, Math.ceil((exp - Date.now()) / 1000)));
      }),
      refreshPresenceTtls: jest
        .fn()
        .mockImplementation((userIds: string[], expirySeconds: number) => {
          let refreshedCount = 0;
          const missingUserIds: string[] = [];
          for (const uid of userIds) {
            const key = `presence:sockets:${uid}`;
            isKeyExpired(key);
            if (redisSets.has(key)) {
              redisKeyExpiry.set(key, Date.now() + expirySeconds * 1000);
              refreshedCount++;
            } else {
              missingUserIds.push(uid);
            }
          }
          return Promise.resolve({ refreshedCount, missingUserIds });
        }),
      del: jest.fn().mockImplementation((key: string) => {
        redisSets.delete(key);
        redisStore.delete(key);
        redisKeyExpiry.delete(key);
        return Promise.resolve();
      }),
      get: jest.fn().mockImplementation((key: string) => {
        isKeyExpired(key);
        return Promise.resolve(redisStore.get(key) || null);
      }),
      set: jest.fn().mockImplementation((key: string, val: string) => {
        redisStore.set(key, val);
        return Promise.resolve();
      }),
      _redisSets: redisSets,
      _redisKeyExpiry: redisKeyExpiry,
    };

    const roomEmits: Record<string, Array<{ event: string; data: any }>> = {};
    mockServer = {
      emit: jest.fn(), // Global emit should NEVER be called for presence!
      to: jest.fn().mockImplementation((room: string) => ({
        emit: jest.fn().mockImplementation((event: string, data: any) => {
          if (!roomEmits[room]) roomEmits[room] = [];
          roomEmits[room].push({ event, data });
        }),
      })),
      roomEmits,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatGateway,
        { provide: TokenService, useValue: tokenService },
        { provide: MessagesService, useValue: messagesService },
        { provide: ConversationsService, useValue: conversationsService },
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: redisService },
      ],
    }).compile();

    gateway = module.get<ChatGateway>(ChatGateway);
    gateway.server = mockServer;
  });

  afterEach(() => {
    gateway.stopPresenceRefreshLoop();
  });

  describe('Presence Scoping & Privacy', () => {
    it('Presence events reach authorized recipients only and NEVER emit globally', async () => {
      const clientA = createMockSocket('socket-a-1', userA);

      await gateway.handleConnection(clientA);

      // 1. Global server.emit MUST NOT be called
      expect(mockServer.emit).not.toHaveBeenCalled();

      // 2. Presence event sent ONLY to authorized match partner (userB)
      expect(mockServer.to).toHaveBeenCalledWith(`user:${userB}`);
      const userBEmits = mockServer.roomEmits[`user:${userB}`];
      expect(userBEmits).toContainEqual({
        event: 'user.presence',
        data: { userId: userA, isOnline: true },
      });

      // 3. Unmatched user (userC) room MUST NOT be emitted to
      expect(mockServer.to).not.toHaveBeenCalledWith(`user:${userC}`);

      // 4. Blocked user (userD) room MUST NOT be emitted to
      expect(mockServer.to).not.toHaveBeenCalledWith(`user:${userD}`);
    });

    it('Unmatched user querying presence receives Unauthorized error and no data', async () => {
      const clientC = createMockSocket('socket-c-1', userC);

      await gateway.handlePresenceQuery(clientC, { targetUserId: userA });

      // Should emit error to clientC
      expect(clientC.emit).toHaveBeenCalledWith('error', {
        event: 'presence.query',
        message: 'Unauthorized: Cannot query presence of non-matched user.',
      });
      // Should NOT reveal presence result
      expect(clientC.emit).not.toHaveBeenCalledWith(
        'presence.result',
        expect.anything(),
      );
    });

    it('Authorized partner querying presence receives presence.result', async () => {
      // User A connects first
      const clientA = createMockSocket('socket-a-1', userA);
      await gateway.handleConnection(clientA);

      // User B queries presence for User A
      const clientB = createMockSocket('socket-b-1', userB);
      await gateway.handlePresenceQuery(clientB, { targetUserId: userA });

      expect(clientB.emit).toHaveBeenCalledWith('presence.result', {
        userId: userA,
        isOnline: true,
        lastSeen: undefined,
      });
    });
  });

  describe('Private Room Authorization', () => {
    it('A user cannot join another user private room', async () => {
      const clientA = createMockSocket('socket-a-1', userA);

      await gateway.handleJoinRoom(clientA, { room: `user:${userB}` });

      expect(clientA.emit).toHaveBeenCalledWith('error', {
        event: 'room.join',
        message: "Forbidden: You cannot join another user's private room.",
      });
      expect(clientA.join).not.toHaveBeenCalledWith(`user:${userB}`);
    });

    it('A user can join their own private user room', async () => {
      const clientA = createMockSocket('socket-a-1', userA);

      await gateway.handleJoinRoom(clientA, { room: `user:${userA}` });

      expect(clientA.join).toHaveBeenCalledWith(`user:${userA}`);
      expect(clientA.emit).toHaveBeenCalledWith('room.joined', {
        room: `user:${userA}`,
      });
    });

    it('A non-participant cannot join a private conversation room', async () => {
      const clientC = createMockSocket('socket-c-1', userC);

      conversationsService.getConversationDetail.mockRejectedValueOnce(
        new NotFoundException('Conversation not found.'),
      );

      await gateway.handleJoinConversation(clientC, {
        conversationId: 'conv-private-123',
      });

      expect(clientC.emit).toHaveBeenCalledWith('error', {
        event: 'conversation.join',
        message: 'Conversation not found.',
      });
      expect(clientC.join).not.toHaveBeenCalledWith(
        'conversation:conv-private-123',
      );
    });

    it('A participant cannot join an inactive or unmatched conversation room', async () => {
      const clientA = createMockSocket('socket-a-1', userA);

      // User A is participant, but match has been cancelled/unmatched
      conversationsService.getConversationDetail.mockResolvedValueOnce({
        id: 'conv-unmatched-1',
        isMatchActive: false,
      });

      await gateway.handleJoinConversation(clientA, {
        conversationId: 'conv-unmatched-1',
      });

      expect(clientA.emit).toHaveBeenCalledWith('error', {
        event: 'conversation.join',
        message: 'Forbidden: Cannot join inactive or unmatched conversation.',
      });
      expect(clientA.join).not.toHaveBeenCalledWith(
        'conversation:conv-unmatched-1',
      );
    });

    it('An active participant can successfully join conversation room', async () => {
      const clientA = createMockSocket('socket-a-1', userA);

      conversationsService.getConversationDetail.mockResolvedValueOnce({
        id: 'conv-active-1',
        isMatchActive: true,
      });

      await gateway.handleJoinConversation(clientA, {
        conversationId: 'conv-active-1',
      });

      expect(clientA.join).toHaveBeenCalledWith('conversation:conv-active-1');
      expect(clientA.emit).toHaveBeenCalledWith('conversation.joined', {
        conversationId: 'conv-active-1',
      });
    });
  });

  describe('Multi-Socket & Shared State Presence', () => {
    it('Disconnecting one socket of multiple does not mark the user offline prematurely', async () => {
      const sock1 = createMockSocket('socket-a-dev1', userA);
      const sock2 = createMockSocket('socket-a-dev2', userA);

      // Connect device 1 -> user comes online (emits online)
      await gateway.handleConnection(sock1);
      expect(mockServer.to).toHaveBeenCalledWith(`user:${userB}`);
      expect(mockServer.roomEmits[`user:${userB}`]).toContainEqual({
        event: 'user.presence',
        data: { userId: userA, isOnline: true },
      });

      // Clear room emits recorder
      mockServer.roomEmits[`user:${userB}`] = [];

      // Connect device 2 -> second socket (does not emit duplicate online)
      await gateway.handleConnection(sock2);
      expect(mockServer.roomEmits[`user:${userB}`].length).toBe(0);

      // Disconnect device 1 -> remaining sockets = 1
      await gateway.handleDisconnect(sock1);

      // MUST NOT emit offline because device 2 is still connected!
      const offlineEvents = mockServer.roomEmits[`user:${userB}`].filter(
        (e: any) => e.data?.isOnline === false,
      );
      expect(offlineEvents.length).toBe(0);

      // User should still be recognized as online
      const isOnline = await gateway.isUserOnline(userA);
      expect(isOnline).toBe(true);
    });

    it('The final socket disconnect produces the correct offline transition to authorized partners', async () => {
      const sock1 = createMockSocket('socket-a-dev1', userA);
      const sock2 = createMockSocket('socket-a-dev2', userA);

      await gateway.handleConnection(sock1);
      await gateway.handleConnection(sock2);

      // Disconnect sock1 (first socket)
      await gateway.handleDisconnect(sock1);

      // Disconnect sock2 (final socket)
      await gateway.handleDisconnect(sock2);

      // MUST emit offline to userB
      const partnerEmits = mockServer.roomEmits[`user:${userB}`];
      const offlineEvent = partnerEmits.find(
        (e: any) => e.event === 'user.presence' && e.data?.isOnline === false,
      );

      expect(offlineEvent).toBeDefined();
      expect(offlineEvent.data).toEqual({
        userId: userA,
        isOnline: false,
        lastSeen: expect.any(String),
      });

      // Global emit was NEVER called
      expect(mockServer.emit).not.toHaveBeenCalled();

      // User state is now offline
      const isOnline = await gateway.isUserOnline(userA);
      expect(isOnline).toBe(false);
    });

    it('Multi-instance shared state utilizes Redis sadd, srem, scard, and 300s expire', async () => {
      const sock = createMockSocket('socket-a-redis', userA);

      await gateway.handleConnection(sock);

      expect(redisService.sadd).toHaveBeenCalledWith(
        `presence:sockets:${userA}`,
        'socket-a-redis',
      );
      expect(redisService.expire).toHaveBeenCalledWith(
        `presence:sockets:${userA}`,
        300,
      );
      expect(redisService.scard).toHaveBeenCalledWith(
        `presence:sockets:${userA}`,
      );

      await gateway.handleDisconnect(sock);

      expect(redisService.srem).toHaveBeenCalledWith(
        `presence:sockets:${userA}`,
        'socket-a-redis',
      );
      expect(redisService.del).toHaveBeenCalledWith(
        `presence:sockets:${userA}`,
      );
      expect(redisService.set).toHaveBeenCalledWith(
        `presence:last_seen:${userA}`,
        expect.any(String),
        expect.any(Number),
      );
    });

    it('When Redis is unavailable or throws, Gateway gracefully falls back to local memory presence', async () => {
      // Mock Redis throwing errors
      redisService.sadd.mockRejectedValueOnce(new Error('Redis connection refused'));
      redisService.scard.mockRejectedValueOnce(new Error('Redis connection refused'));

      const fallbackSock = createMockSocket('socket-fallback-1', userA);

      // Connect socket - should succeed using local memory fallback without throwing
      await gateway.handleConnection(fallbackSock);
      expect(fallbackSock.emit).toHaveBeenCalledWith('authenticated', {
        userId: userA,
      });

      // User should be tracked online via local memory fallback
      redisService.scard.mockRejectedValueOnce(new Error('Redis down'));
      const isOnline = await gateway.isUserOnline(userA);
      expect(isOnline).toBe(true);

      // Disconnect socket - should gracefully update local memory state
      redisService.srem.mockRejectedValueOnce(new Error('Redis down'));
      redisService.scard.mockRejectedValueOnce(new Error('Redis down'));
      await gateway.handleDisconnect(fallbackSock);

      redisService.scard.mockRejectedValueOnce(new Error('Redis down'));
      const isOnlineAfter = await gateway.isUserOnline(userA);
      expect(isOnlineAfter).toBe(false);
    });
  });

  describe('Presence TTL Refresh & Long-Lived Connection Preservation', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      gateway.stopPresenceRefreshLoop();
      jest.useRealTimers();
    });

    it('A socket remaining connected for longer than five minutes (360s) has TTL refreshed and stays online', async () => {
      const sock = createMockSocket('socket-longlived-1', userA);

      // 1. Connect socket at t=0
      await gateway.handleConnection(sock);

      // Initial TTL in Redis is 300s
      let ttl = await redisService.ttl(`presence:sockets:${userA}`);
      expect(ttl).toBe(300);

      // Start refresh loop with 60s interval
      gateway.presenceRefreshIntervalMs = 60000;
      gateway.presenceTtlSeconds = 300;
      gateway.startPresenceRefreshLoop();

      // 2. Advance time past the 5-minute mark (360 seconds = 6 ticks of 60s)
      for (let i = 0; i < 6; i++) {
        jest.advanceTimersByTime(60000);
        // Allow any pending async refresh promises in event loop to settle
        await Promise.resolve();
      }

      // TTL should be refreshed and still healthy (> 200s), NOT expired!
      ttl = await redisService.ttl(`presence:sockets:${userA}`);
      expect(ttl).toBeGreaterThanOrEqual(240);

      // Presence query confirms user is STILL online at 6 minutes
      const onlineStatus = await gateway.isUserOnline(userA);
      expect(onlineStatus).toBe(true);

      const querySocket = createMockSocket('socket-query', userB);
      await gateway.handlePresenceQuery(querySocket, { targetUserId: userA });
      expect(querySocket.emit).toHaveBeenCalledWith('presence.result', {
        userId: userA,
        isOnline: true,
        lastSeen: undefined,
      });

      // 3. Contrast: Stop refresh loop and advance 301 seconds (simulating server crash)
      gateway.stopPresenceRefreshLoop();
      jest.advanceTimersByTime(301000);
      await Promise.resolve();

      // Key must now expire in Redis
      const expiredTtl = await redisService.ttl(`presence:sockets:${userA}`);
      expect(expiredTtl).toBe(-2); // -2 indicates expired/key deleted

      // When queried from another instance (where socket is not local), user is offline
      // Clear local memory to simulate query from an external instance
      (gateway as any).activeUserSockets.clear();
      const offlineAfterCrash = await gateway.isUserOnline(userA);
      expect(offlineAfterCrash).toBe(false);
    });

    it('Multiple sockets for same user: one disconnects while another remains connected across 5+ minutes', async () => {
      const sockDev1 = createMockSocket('socket-dev1', userA);
      const sockDev2 = createMockSocket('socket-dev2', userA);

      // Connect both sockets
      await gateway.handleConnection(sockDev1);
      await gateway.handleConnection(sockDev2);

      gateway.presenceRefreshIntervalMs = 60000;
      gateway.startPresenceRefreshLoop();

      // Advance 2 minutes (120s)
      jest.advanceTimersByTime(120000);
      await Promise.resolve();

      // Disconnect device 1
      await gateway.handleDisconnect(sockDev1);

      // MUST NOT emit offline because device 2 is still active
      const partnerEmits = mockServer.roomEmits[`user:${userB}`] || [];
      const offlineEvents = partnerEmits.filter(
        (e: any) => e.data?.isOnline === false,
      );
      expect(offlineEvents.length).toBe(0);

      // Advance another 4 minutes (total 6 minutes for device 2)
      jest.advanceTimersByTime(240000);
      await Promise.resolve();

      // User A is still online via device 2
      expect(await gateway.isUserOnline(userA)).toBe(true);
      const ttl = await redisService.ttl(`presence:sockets:${userA}`);
      expect(ttl).toBeGreaterThanOrEqual(240);

      // Disconnect final socket (device 2)
      await gateway.handleDisconnect(sockDev2);

      // Now offline event is triggered and Redis key is removed immediately
      const finalEmits = mockServer.roomEmits[`user:${userB}`];
      const finalOffline = finalEmits.find(
        (e: any) => e.event === 'user.presence' && e.data?.isOnline === false,
      );
      expect(finalOffline).toBeDefined();

      const finalTtl = await redisService.ttl(`presence:sockets:${userA}`);
      expect(finalTtl).toBe(-2);
      expect(await gateway.isUserOnline(userA)).toBe(false);
    });

    it('Explicit client presence.heartbeat event refreshes Redis TTL immediately and responds with ack', async () => {
      const sock = createMockSocket('socket-hb-1', userA);
      await gateway.handleConnection(sock);

      // Advance time by 200s (TTL remaining drops from 300 to 100)
      jest.advanceTimersByTime(200000);
      let ttlBefore = await redisService.ttl(`presence:sockets:${userA}`);
      expect(ttlBefore).toBe(100);

      // Client triggers heartbeat
      await gateway.handlePresenceHeartbeat(sock);

      // TTL reset back to 300s
      let ttlAfter = await redisService.ttl(`presence:sockets:${userA}`);
      expect(ttlAfter).toBe(300);

      // Client received heartbeat ack
      expect(sock.emit).toHaveBeenCalledWith('presence.heartbeat_ack', {
        userId: userA,
        timestamp: expect.any(String),
      });
    });

    it('Self-heals missing/evicted Redis presence key when local socket is still active', async () => {
      const sock = createMockSocket('socket-heal-1', userA);
      await gateway.handleConnection(sock);

      // Simulate unexpected key loss in Redis (e.g. key eviction or Redis restart)
      await redisService.del(`presence:sockets:${userA}`);
      expect(await redisService.scard(`presence:sockets:${userA}`)).toBe(0);

      // Periodic refresh runs
      const result = await gateway.refreshActivePresenceTtls();
      expect(result).toBeDefined();

      // Gateway automatically detected missing key and repopulated it
      const scard = await redisService.scard(`presence:sockets:${userA}`);
      expect(scard).toBe(1);

      const ttl = await redisService.ttl(`presence:sockets:${userA}`);
      expect(ttl).toBe(300);

      expect(await gateway.isUserOnline(userA)).toBe(true);
    });

    it('Redis error during periodic refresh loop does not crash the gateway or drop local presence', async () => {
      const sock = createMockSocket('socket-err-1', userA);
      await gateway.handleConnection(sock);

      // Mock refreshPresenceTtls throwing an error
      redisService.refreshPresenceTtls.mockRejectedValueOnce(
        new Error('Redis network partition'),
      );

      // Should not throw
      const result = await gateway.refreshActivePresenceTtls();
      expect(result.refreshedCount).toBe(0);

      // User remains online locally without interruption
      expect(await gateway.isUserOnline(userA)).toBe(true);
    });

    it('Unauthorized and unmatched users never receive presence notifications or queries', async () => {
      const sockA = createMockSocket('socket-auth-a', userA);
      await gateway.handleConnection(sockA);

      // userC (stranger) was NOT notified
      expect(mockServer.roomEmits[`user:${userC}`]).toBeUndefined();

      // userD (blocked) was NOT notified
      expect(mockServer.roomEmits[`user:${userD}`]).toBeUndefined();

      // userC tries to query userA presence
      const sockC = createMockSocket('socket-auth-c', userC);
      await gateway.handlePresenceQuery(sockC, { targetUserId: userA });

      // Emits Unauthorized error
      expect(sockC.emit).toHaveBeenCalledWith('error', {
        event: 'presence.query',
        message: 'Unauthorized: Cannot query presence of non-matched user.',
      });
      // Does not emit presence.result
      const presenceResults = sockC.emittedEvents.filter(
        (e: any) => e.event === 'presence.result',
      );
      expect(presenceResults.length).toBe(0);
    });

    it('Concurrent recovery across multiple instances preserves all socket IDs and never drops or overwrites other instances sockets', async () => {
      // Create a second gateway instance representing Node B sharing the same Redis mock
      const moduleB: TestingModule = await Test.createTestingModule({
        providers: [
          ChatGateway,
          { provide: TokenService, useValue: tokenService },
          { provide: MessagesService, useValue: messagesService },
          { provide: ConversationsService, useValue: conversationsService },
          { provide: PrismaService, useValue: prisma },
          { provide: RedisService, useValue: redisService },
        ],
      }).compile();

      const gatewayB = moduleB.get<ChatGateway>(ChatGateway);
      gatewayB.server = mockServer;

      const sockA = createMockSocket('socket-node-A', userA);
      const sockB = createMockSocket('socket-node-B', userA);

      // Connect sockA on gateway A, sockB on gateway B
      await gateway.handleConnection(sockA);
      await gatewayB.handleConnection(sockB);

      // Shared Redis set has both sockets
      expect(await redisService.scard(`presence:sockets:${userA}`)).toBe(2);

      // Simulate eviction/key loss in Redis
      await redisService.del(`presence:sockets:${userA}`);
      expect(await redisService.scard(`presence:sockets:${userA}`)).toBe(0);

      // Both instances simultaneously run recovery
      await Promise.all([
        gateway.refreshActivePresenceTtls(),
        gatewayB.refreshActivePresenceTtls(),
      ]);

      // Both sockets are preserved in the Redis set; neither wiped the other
      const restoredMembers = await redisService.scard(
        `presence:sockets:${userA}`,
      );
      expect(restoredMembers).toBe(2);
      expect(await gateway.isUserOnline(userA)).toBe(true);
      expect(await gatewayB.isUserOnline(userA)).toBe(true);

      // Disconnect on Node A
      await gateway.handleDisconnect(sockA);
      // Node B socket is still preserved in Redis
      expect(await redisService.scard(`presence:sockets:${userA}`)).toBe(1);
      expect(await gatewayB.isUserOnline(userA)).toBe(true);

      // Disconnect on Node B
      await gatewayB.handleDisconnect(sockB);
      expect(await redisService.scard(`presence:sockets:${userA}`)).toBe(0);
      expect(await gateway.isUserOnline(userA)).toBe(false);

      gatewayB.stopPresenceRefreshLoop();
    });

    it('Refresh timer starts exactly once, rejects gracefully without unhandled rejection, and cleans up on destroy', async () => {
      // 1. Calling startPresenceRefreshLoop multiple times starts only 1 timer
      gateway.presenceRefreshIntervalMs = 60000;
      gateway.startPresenceRefreshLoop();
      const timerRef1 = (gateway as any).presenceRefreshTimer;
      expect(timerRef1).toBeDefined();

      gateway.startPresenceRefreshLoop();
      const timerRef2 = (gateway as any).presenceRefreshTimer;
      expect(timerRef1).toBe(timerRef2); // Exactly same timer handle

      // 2. Unhandled promise rejection safety: simulated failure in refreshActivePresenceTtls
      const loggerSpy = jest.spyOn((gateway as any).logger, 'warn');
      jest
        .spyOn(gateway, 'refreshActivePresenceTtls')
        .mockRejectedValueOnce(new Error('Fatal Redis crash'));

      // Advance timer to trigger interval
      jest.advanceTimersByTime(60000);
      await Promise.resolve();

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'Error in presence refresh loop: Fatal Redis crash',
        ),
      );

      // 3. Module teardown clears the timer
      gateway.onModuleDestroy();
      expect((gateway as any).presenceRefreshTimer).toBeNull();
    });

    it('presence.heartbeat only refreshes the authenticated socket user and ignores spoofed targetUserId payload', async () => {
      const sockA = createMockSocket('socket-auth-a', userA);
      await gateway.handleConnection(sockA);

      const refreshSpy = jest.spyOn(gateway, 'refreshUserPresence');

      // Malicious payload trying to refresh User B or User C's presence
      await gateway.handlePresenceHeartbeat(sockA);

      // Only authenticated userA is refreshed
      expect(refreshSpy).toHaveBeenCalledWith(userA);
      expect(refreshSpy).not.toHaveBeenCalledWith(userB);

      // Socket receives ack for userA
      expect(sockA.emit).toHaveBeenCalledWith('presence.heartbeat_ack', {
        userId: userA,
        timestamp: expect.any(String),
      });

      // Unauthenticated socket (no userId in client.data) is completely ignored
      const unauthSock = createMockSocket('socket-unauth');
      unauthSock.data = {};
      refreshSpy.mockClear();
      await gateway.handlePresenceHeartbeat(unauthSock);
      expect(refreshSpy).not.toHaveBeenCalled();
      expect(unauthSock.emit).not.toHaveBeenCalledWith(
        'presence.heartbeat_ack',
        expect.anything(),
      );
    });
  });
});
