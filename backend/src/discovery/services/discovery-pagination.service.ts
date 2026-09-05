import { Injectable, BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';

export interface DecodedCursor {
  offset: number;
  timestamp: number;
}

const CURSOR_EXPIRY_MS = 2 * 60 * 60 * 1000; // 2 hours

@Injectable()
export class DiscoveryPaginationService {
  private readonly secretKey =
    process.env.JWT_ACCESS_SECRET || 'discovery_cursor_secret_key_123';

  /**
   * Generates an opaque, tamper-resistant cursor token.
   */
  createCursor(offset: number): string {
    const timestamp = Date.now();
    const payload = `${offset}:${timestamp}`;
    const hmac = crypto
      .createHmac('sha256', this.secretKey)
      .update(payload)
      .digest('hex')
      .slice(0, 16);

    const token = `${payload}:${hmac}`;
    return Buffer.from(token).toString('base64url');
  }

  encodeCursor(offset: number): string {
    return this.createCursor(offset);
  }

  /**
   * Decodes and validates an incoming cursor token.
   */
  decodeCursor(cursorStr?: string): DecodedCursor {
    if (!cursorStr) {
      return { offset: 0, timestamp: Date.now() };
    }

    try {
      const raw = Buffer.from(cursorStr, 'base64url').toString('utf8');
      const parts = raw.split(':');
      if (parts.length !== 3) {
        throw new BadRequestException('Invalid discovery cursor format.');
      }

      const offset = parseInt(parts[0], 10);
      const timestamp = parseInt(parts[1], 10);
      const checksum = parts[2];

      if (isNaN(offset) || isNaN(timestamp) || offset < 0) {
        throw new BadRequestException('Invalid discovery cursor values.');
      }

      // Checksum validation
      const payload = `${offset}:${timestamp}`;
      const expectedHmac = crypto
        .createHmac('sha256', this.secretKey)
        .update(payload)
        .digest('hex')
        .slice(0, 16);

      if (
        !crypto.timingSafeEqual(
          Buffer.from(checksum),
          Buffer.from(expectedHmac),
        )
      ) {
        throw new BadRequestException('Tampered discovery cursor.');
      }

      // Expiry validation
      if (Date.now() - timestamp > CURSOR_EXPIRY_MS) {
        // Expired cursor resets gracefully to offset 0
        return { offset: 0, timestamp: Date.now() };
      }

      return { offset, timestamp };
    } catch (err: any) {
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException('Invalid discovery cursor.');
    }
  }
}
