import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';
import { normalizeText } from '../utils/text-normalizer.util';
import * as crypto from 'crypto';

export interface SpamCheckResult {
  isSpam: boolean;
  reason?: string;
  distinctRecipientsCount?: number;
}

const MASS_SPAM_RECIPIENT_THRESHOLD = 5;
const HASH_WINDOW_SECONDS = 3600; // 1 hour window
const VELOCITY_WINDOW_SECONDS = 60; // 1 minute window
const MAX_MESSAGES_PER_MINUTE = 25; // Inter-conversation throttle

@Injectable()
export class SpamDetectionService {
  private readonly logger = new Logger(SpamDetectionService.name);

  constructor(private readonly redisService: RedisService) {}

  /**
   * Computes a deterministic SHA-256 fingerprint from collapsed normalized text.
   */
  computeMessageHash(text: string): string {
    const collapsed = normalizeText(text).collapsed;
    return crypto.createHash('sha256').update(collapsed).digest('hex').substring(0, 16);
  }

  /**
   * Validates if a message is a mass copy-paste blast across 5+ different recipients
   * or exceeds aggressive messaging velocity.
   */
  async checkSpam(
    senderUserId: string,
    recipientUserId: string,
    messageBody: string,
  ): Promise<SpamCheckResult> {
    const trimmed = messageBody.trim();
    if (!trimmed || trimmed.length < 5) {
      return { isSpam: false };
    }

    // 1. Inter-conversation velocity throttle check
    const velocityKey = `spam:velocity:${senderUserId}`;
    if (typeof this.redisService.incrementWithWindow === 'function') {
      try {
        const velocity = await this.redisService.incrementWithWindow(
          velocityKey,
          VELOCITY_WINDOW_SECONDS,
        );

        if (velocity && velocity.current > MAX_MESSAGES_PER_MINUTE) {
          this.logger.warn(
            `[SPAM_VELOCITY_EXCEEDED] User ${senderUserId} exceeded global rate limit (${velocity.current}/${MAX_MESSAGES_PER_MINUTE} in 60s)`,
          );
          return {
            isSpam: true,
            reason: 'You are sending messages too rapidly across conversations. Please slow down.',
          };
        }
      } catch (err) {
        this.logger.warn(
          `[SPAM_VELOCITY_REDIS_ERROR] Could not check velocity: ${(err as Error).message}`,
        );
      }
    }

    // 2. Mass copy-paste detection across recipients
    const msgHash = this.computeMessageHash(trimmed);
    const hashKey = `spam:hash:${senderUserId}:${msgHash}`;
    let recipients: string[] = [];

    if (typeof this.redisService.get === 'function') {
      try {
        const existingRecipientsStr = await this.redisService.get(hashKey);
        if (existingRecipientsStr) {
          recipients = existingRecipientsStr.split(',').filter(Boolean);
        }

        if (!recipients.includes(recipientUserId)) {
          recipients.push(recipientUserId);
          if (typeof this.redisService.set === 'function') {
            await this.redisService.set(
              hashKey,
              recipients.join(','),
              HASH_WINDOW_SECONDS,
            );
          }
        }
      } catch (err) {
        this.logger.warn(
          `[SPAM_HASH_REDIS_ERROR] Could not check or update copy-paste hash: ${(err as Error).message}`,
        );
      }
    }

    if (recipients.length >= MASS_SPAM_RECIPIENT_THRESHOLD) {
      this.logger.warn(
        `[SPAM_MASS_COPY_PASTE] User ${senderUserId} sent identical message to ${recipients.length} recipients within 1h (Hash: ${msgHash})`,
      );
      return {
        isSpam: true,
        distinctRecipientsCount: recipients.length,
        reason:
          'Mass copy-pasting identical messages to multiple members violates our anti-spam community policy.',
      };
    }

    return { isSpam: false, distinctRecipientsCount: recipients.length };
  }
}
