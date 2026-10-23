import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

interface MemoryRecord {
  value: string;
  expiresAt: number | null;
}

interface MemorySetRecord {
  members: Set<string>;
  expiresAt: number | null;
}

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;
  private isConnected = false;
  private readonly memoryStore = new Map<string, MemoryRecord>();
  private readonly memorySets = new Map<string, MemorySetRecord>();

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    const redisUrl =
      this.configService.get<string>('REDIS_URL') || 'redis://localhost:6379';
    const nodeEnv = this.configService.get<string>('NODE_ENV') || 'development';
    const isProduction = nodeEnv === 'production';

    if (redisUrl === 'memory' || redisUrl === 'none') {
      this.logger.log(`Using in-memory store for ${nodeEnv} environment (REDIS_URL=${redisUrl})`);
      this.isConnected = false;
      return;
    }

    try {
      this.client = new Redis(redisUrl, {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        retryStrategy: (times) => {
          if (times > 3) return null;
          return Math.min(times * 100, 1000);
        },
      });

      this.client.on('error', (err) => {
        if (!this.isConnected) {
          this.logger.debug(`Redis connection attempt: ${err.message}`);
        } else {
          this.logger.error(`Redis error: ${err.message}`);
        }
      });

      await this.client.connect();
      this.isConnected = true;
      this.logger.log(`Connected to Redis at ${redisUrl}`);
    } catch (error) {
      if (isProduction) {
        this.logger.error(
          'CRITICAL: Redis connection failed in production mode.',
        );
        throw new Error(
          `Production Redis connection failure: ${(error as Error).message}`,
        );
      } else {
        this.logger.warn(
          `Redis not available at ${redisUrl}. Falling back to in-memory store for ${nodeEnv} environment.`,
        );
        this.isConnected = false;
        if (this.client) {
          this.client.disconnect(false);
          this.client = null;
        }
      }
    }
  }

  async onModuleDestroy() {
    if (this.client) {
      if (this.isConnected) {
        try {
          await this.client.quit();
          this.logger.log('Disconnected from Redis');
        } catch {
          this.client.disconnect(false);
        }
      } else {
        this.client.disconnect(false);
      }
      this.client = null;
    }
    this.isConnected = false;
    this.memoryStore.clear();
    this.memorySets.clear();
  }

  /**
   * Atomic SET with optional NX (only if Not eXists) and EX (expiry in seconds).
   * Returns true if key was set, false if NX condition failed or error occurred.
   */
  async setWithNx(
    key: string,
    value: string,
    expirySeconds: number,
  ): Promise<boolean> {
    if (this.isConnected && this.client) {
      const result = await this.client.set(
        key,
        value,
        'EX',
        expirySeconds,
        'NX',
      );
      return result === 'OK';
    }

    // In-memory fallback (Atomic via Node single-thread event loop)
    this.cleanExpiredMemoryKey(key);
    if (this.memoryStore.has(key)) {
      return false;
    }

    this.memoryStore.set(key, {
      value,
      expiresAt: Date.now() + expirySeconds * 1000,
    });
    return true;
  }

  /**
   * Increments a key counter within a sliding or fixed time window.
   * If the key is new, sets the expiry window.
   */
  async incrementWithWindow(
    key: string,
    windowSeconds: number,
  ): Promise<{ current: number; isFirst: boolean }> {
    if (this.isConnected && this.client) {
      const current = await this.client.incr(key);
      if (current === 1) {
        await this.client.expire(key, windowSeconds);
      }
      return { current, isFirst: current === 1 };
    }

    // In-memory fallback
    this.cleanExpiredMemoryKey(key);
    const existing = this.memoryStore.get(key);
    if (!existing) {
      this.memoryStore.set(key, {
        value: '1',
        expiresAt: Date.now() + windowSeconds * 1000,
      });
      return { current: 1, isFirst: true };
    }

    const nextVal = parseInt(existing.value, 10) + 1;
    existing.value = nextVal.toString();
    return { current: nextVal, isFirst: false };
  }

  async get(key: string): Promise<string | null> {
    if (this.isConnected && this.client) {
      return this.client.get(key);
    }

    this.cleanExpiredMemoryKey(key);
    const record = this.memoryStore.get(key);
    return record ? record.value : null;
  }

  async set(key: string, value: string, expirySeconds?: number): Promise<void> {
    if (this.isConnected && this.client) {
      if (expirySeconds) {
        await this.client.set(key, value, 'EX', expirySeconds);
      } else {
        await this.client.set(key, value);
      }
    } else {
      this.memoryStore.set(key, {
        value,
        expiresAt: expirySeconds ? Date.now() + expirySeconds * 1000 : null,
      });
    }
  }

  async del(key: string): Promise<void> {
    if (this.isConnected && this.client) {
      await this.client.del(key);
    } else {
      this.memoryStore.delete(key);
      this.memorySets.delete(key);
    }
  }

  async sadd(key: string, member: string): Promise<number> {
    if (this.isConnected && this.client) {
      return this.client.sadd(key, member);
    }

    this.cleanExpiredMemorySet(key);
    let record = this.memorySets.get(key);
    if (!record) {
      record = { members: new Set<string>(), expiresAt: null };
      this.memorySets.set(key, record);
    }
    const had = record.members.has(member);
    record.members.add(member);
    return had ? 0 : 1;
  }

  async srem(key: string, member: string): Promise<number> {
    if (this.isConnected && this.client) {
      return this.client.srem(key, member);
    }

    this.cleanExpiredMemorySet(key);
    const record = this.memorySets.get(key);
    if (!record) return 0;
    const removed = record.members.delete(member);
    if (record.members.size === 0) {
      this.memorySets.delete(key);
    }
    return removed ? 1 : 0;
  }

  async scard(key: string): Promise<number> {
    if (this.isConnected && this.client) {
      return this.client.scard(key);
    }

    this.cleanExpiredMemorySet(key);
    const record = this.memorySets.get(key);
    return record ? record.members.size : 0;
  }

  async smembers(key: string): Promise<string[]> {
    if (this.isConnected && this.client) {
      return this.client.smembers(key);
    }

    this.cleanExpiredMemorySet(key);
    const record = this.memorySets.get(key);
    return record ? Array.from(record.members) : [];
  }

  async expire(key: string, seconds: number): Promise<boolean> {
    if (this.isConnected && this.client) {
      const res = await this.client.expire(key, seconds);
      return res === 1;
    }

    this.cleanExpiredMemoryKey(key);
    this.cleanExpiredMemorySet(key);

    const valRecord = this.memoryStore.get(key);
    if (valRecord) {
      valRecord.expiresAt = Date.now() + seconds * 1000;
      return true;
    }
    const setRecord = this.memorySets.get(key);
    if (setRecord) {
      setRecord.expiresAt = Date.now() + seconds * 1000;
      return true;
    }
    return false;
  }

  /**
   * Retrieves remaining TTL in seconds for a key.
   * Returns -2 if key does not exist or expired, -1 if no expiry set.
   */
  async ttl(key: string): Promise<number> {
    if (this.isConnected && this.client) {
      return this.client.ttl(key);
    }

    this.cleanExpiredMemoryKey(key);
    this.cleanExpiredMemorySet(key);

    const valRecord = this.memoryStore.get(key);
    if (valRecord) {
      if (valRecord.expiresAt === null) return -1;
      return Math.max(0, Math.ceil((valRecord.expiresAt - Date.now()) / 1000));
    }
    const setRecord = this.memorySets.get(key);
    if (setRecord) {
      if (setRecord.expiresAt === null) return -1;
      return Math.max(0, Math.ceil((setRecord.expiresAt - Date.now()) / 1000));
    }
    return -2;
  }

  /**
   * Refreshes the expiry on a batch of presence keys.
   * Uses pipelined Redis operations when connected, or memory updates in fallback.
   */
  async refreshPresenceTtls(
    userIds: string[],
    expirySeconds: number,
  ): Promise<{ refreshedCount: number; missingUserIds: string[] }> {
    if (userIds.length === 0) {
      return { refreshedCount: 0, missingUserIds: [] };
    }

    if (this.isConnected && this.client) {
      const pipeline = this.client.pipeline();
      for (const userId of userIds) {
        pipeline.expire(`presence:sockets:${userId}`, expirySeconds);
      }
      const results = await pipeline.exec();
      let refreshedCount = 0;
      const missingUserIds: string[] = [];

      if (results) {
        results.forEach(([err, result], idx) => {
          if (!err && result === 1) {
            refreshedCount++;
          } else {
            missingUserIds.push(userIds[idx]);
          }
        });
      }
      return { refreshedCount, missingUserIds };
    }

    // In-memory fallback
    let refreshedCount = 0;
    const missingUserIds: string[] = [];
    for (const userId of userIds) {
      const refreshed = await this.expire(
        `presence:sockets:${userId}`,
        expirySeconds,
      );
      if (refreshed) {
        refreshedCount++;
      } else {
        missingUserIds.push(userId);
      }
    }
    return { refreshedCount, missingUserIds };
  }

  private cleanExpiredMemoryKey(key: string): void {
    const record = this.memoryStore.get(key);
    if (record && record.expiresAt && record.expiresAt <= Date.now()) {
      this.memoryStore.delete(key);
    }
  }

  private cleanExpiredMemorySet(key: string): void {
    const record = this.memorySets.get(key);
    if (record && record.expiresAt && record.expiresAt <= Date.now()) {
      this.memorySets.delete(key);
    }
  }
}
