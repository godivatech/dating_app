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

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;
  private isConnected = false;
  private readonly memoryStore = new Map<string, MemoryRecord>();

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    const redisUrl =
      this.configService.get<string>('REDIS_URL') || 'redis://localhost:6379';
    const nodeEnv = this.configService.get<string>('NODE_ENV') || 'development';
    const isProduction = nodeEnv === 'production';

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
          this.client.disconnect();
          this.client = null;
        }
      }
    }
  }

  async onModuleDestroy() {
    if (this.client && this.isConnected) {
      await this.client.quit();
      this.logger.log('Disconnected from Redis');
    }
    this.memoryStore.clear();
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
    }
  }

  private cleanExpiredMemoryKey(key: string): void {
    const record = this.memoryStore.get(key);
    if (record && record.expiresAt && record.expiresAt <= Date.now()) {
      this.memoryStore.delete(key);
    }
  }
}
