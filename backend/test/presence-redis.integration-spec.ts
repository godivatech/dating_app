import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MatchStatus } from '@prisma/client';
import { ChatGateway } from '../src/chat/gateways/chat.gateway';
import { RedisService } from '../src/redis/redis.service';
import { TokenService } from '../src/auth/services/token.service';
import { MessagesService } from '../src/chat/services/messages.service';
import { ConversationsService } from '../src/chat/services/conversations.service';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Component Test Suite: Presence & In-Memory RedisService Fallback (Simulated Fake Time)
 *
 * NOTE: This test suite uses RedisService's built-in in-memory fallback storage
 * (REDIS_URL='memory') and Jest fake timers (jest.useFakeTimers()) to deterministically
 * test TTL calculations, multi-socket lifecycle, and crash eviction mechanics without
 * connecting to an external Redis daemon on the network.
 */
describe('Presence & RedisService Fallback (In-Memory Simulated Time)', () => {
  let gateway: ChatGateway;
  let redisService: RedisService;
  let mockServer: any;

  const userA = 'user-alice-real-redis';
  const userB = 'user-bob-real-redis';

  const createMockSocket = (id: string, tokenUserId: string) => {
    const emittedEvents: Array<{ event: string; data: any }> = [];
    return {
      id,
      handshake: {
        auth: { token: `Bearer token-${tokenUserId}` },
        headers: {},
      },
      data: { userId: tokenUserId },
      join: jest.fn().mockResolvedValue(undefined),
      leave: jest.fn().mockResolvedValue(undefined),
      emit: jest.fn().mockImplementation((event: string, data: any) => {
        emittedEvents.push({ event, data });
      }),
      disconnect: jest.fn(),
      emittedEvents,
    } as any;
  };

  beforeAll(async () => {
    const configService = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'NODE_ENV') return 'test';
        if (key === 'REDIS_URL') return 'memory';
        return null;
      }),
    };

    const tokenService = {
      verifyAccessToken: jest.fn().mockImplementation((token: string) => {
        const userId = token.replace('token-', '');
        return Promise.resolve({ sub: userId });
      }),
    };

    const prisma = {
      match: {
        findMany: jest.fn().mockResolvedValue([
          { user1Id: userA, user2Id: userB, status: MatchStatus.ACTIVE },
        ]),
        findFirst: jest.fn().mockResolvedValue({ id: 'match-1', status: MatchStatus.ACTIVE }),
      },
      block: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({ lastLoginAt: new Date() }),
      },
    };

    const roomEmits: Record<string, Array<{ event: string; data: any }>> = {};
    mockServer = {
      emit: jest.fn(),
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
        RedisService,
        { provide: ConfigService, useValue: configService },
        { provide: TokenService, useValue: tokenService },
        { provide: MessagesService, useValue: {} },
        { provide: ConversationsService, useValue: {} },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    redisService = module.get<RedisService>(RedisService);
    await redisService.onModuleInit();

    gateway = module.get<ChatGateway>(ChatGateway);
    gateway.server = mockServer;
  });

  afterAll(async () => {
    gateway.stopPresenceRefreshLoop();
    await redisService.onModuleDestroy();
  });

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    gateway.stopPresenceRefreshLoop();
    jest.useRealTimers();
  });

  it('Real RedisService: Active socket survives past 5 minutes (360s) via periodic TTL refresh', async () => {
    const sock = createMockSocket('sock-real-1', userA);
    await gateway.handleConnection(sock);

    // Initial TTL in real RedisService is 300s
    let ttl = await redisService.ttl(`presence:sockets:${userA}`);
    expect(ttl).toBe(300);

    gateway.presenceRefreshIntervalMs = 60000;
    gateway.presenceTtlSeconds = 300;
    gateway.startPresenceRefreshLoop();

    // Advance 6 minutes (360s) in 60s increments
    for (let i = 0; i < 6; i++) {
      jest.advanceTimersByTime(60000);
      await gateway.refreshActivePresenceTtls();
    }

    // Key has NOT expired in RedisService
    ttl = await redisService.ttl(`presence:sockets:${userA}`);
    expect(ttl).toBeGreaterThanOrEqual(240);

    // Online status is true in RedisService
    const count = await redisService.scard(`presence:sockets:${userA}`);
    expect(count).toBe(1);
    expect(await gateway.isUserOnline(userA)).toBe(true);

    // Simulate server crash: stop refresh loop and advance 301 seconds without disconnect
    gateway.stopPresenceRefreshLoop();
    jest.advanceTimersByTime(301000);

    // Key in RedisService has expired after 300s
    const expiredTtl = await redisService.ttl(`presence:sockets:${userA}`);
    expect(expiredTtl).toBe(-2);
    const expiredCount = await redisService.scard(`presence:sockets:${userA}`);
    expect(expiredCount).toBe(0);

    // Clean up local socket map for test teardown
    (gateway as any).activeUserSockets.clear();
  });

  it('Real RedisService: Multi-socket partial disconnect preserves TTL and avoids false offline', async () => {
    const sock1 = createMockSocket('sock-multi-1', userA);
    const sock2 = createMockSocket('sock-multi-2', userA);

    await gateway.handleConnection(sock1);
    await gateway.handleConnection(sock2);

    expect(await redisService.scard(`presence:sockets:${userA}`)).toBe(2);

    // Disconnect sock1
    await gateway.handleDisconnect(sock1);

    // One socket remains in real RedisService
    expect(await redisService.scard(`presence:sockets:${userA}`)).toBe(1);
    expect(await gateway.isUserOnline(userA)).toBe(true);

    // Advance 6 minutes keeping sock2 alive
    gateway.presenceRefreshIntervalMs = 60000;
    gateway.startPresenceRefreshLoop();
    for (let i = 0; i < 6; i++) {
      jest.advanceTimersByTime(60000);
      await gateway.refreshActivePresenceTtls();
    }

    expect(await redisService.scard(`presence:sockets:${userA}`)).toBe(1);
    expect(await gateway.isUserOnline(userA)).toBe(true);

    // Disconnect final socket (sock2)
    await gateway.handleDisconnect(sock2);

    // Key is deleted from real RedisService
    expect(await redisService.scard(`presence:sockets:${userA}`)).toBe(0);
    expect(await redisService.ttl(`presence:sockets:${userA}`)).toBe(-2);
    expect(await gateway.isUserOnline(userA)).toBe(false);
  });
});
