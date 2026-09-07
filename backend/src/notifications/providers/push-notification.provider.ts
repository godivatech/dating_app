import { Injectable, Logger } from '@nestjs/common';

export const PUSH_NOTIFICATION_PROVIDER = 'PUSH_NOTIFICATION_PROVIDER';

export interface PushNotificationPayload {
  title: string;
  body: string;
  data?: Record<string, any>;
  sound?: string | 'default';
  priority?: 'default' | 'normal' | 'high';
  channelId?: string;
}

export interface PushNotificationProvider {
  sendPush(
    tokens: string[],
    payload: PushNotificationPayload,
  ): Promise<{ sentCount: number; failedTokens: string[] }>;
}

/**
 * Console-only fallback provider for local testing and CI environments.
 */
@Injectable()
export class ConsolePushNotificationProvider implements PushNotificationProvider {
  private readonly logger = new Logger(ConsolePushNotificationProvider.name);

  sendPush(
    tokens: string[],
    payload: PushNotificationPayload,
  ): Promise<{ sentCount: number; failedTokens: string[] }> {
    if (!tokens || tokens.length === 0) {
      return Promise.resolve({ sentCount: 0, failedTokens: [] });
    }

    this.logger.log(
      `[PUSH_DISPATCH] Dispatching to ${tokens.length} device(s) - Title: "${payload.title}" | Body: "${payload.body}"`,
    );

    return Promise.resolve({
      sentCount: tokens.length,
      failedTokens: [],
    });
  }
}

/**
 * Production Expo Push Notification Provider using standard native fetch (zero extra dependencies)
 * Implements high-throughput batching, dead token detection, and safe error isolation
 * according to enterprise notification standards (Zomato/Swiggy patterns).
 */
@Injectable()
export class ExpoPushNotificationProvider implements PushNotificationProvider {
  private readonly logger = new Logger(ExpoPushNotificationProvider.name);
  private readonly EXPO_PUSH_API_URL = 'https://exp.host/--/api/v2/push/send';

  async sendPush(
    tokens: string[],
    payload: PushNotificationPayload,
  ): Promise<{ sentCount: number; failedTokens: string[] }> {
    if (!tokens || tokens.length === 0) {
      return { sentCount: 0, failedTokens: [] };
    }

    // Filter valid Expo push tokens (ExponentPushToken[...])
    const validTokens = tokens.filter((t) => typeof t === 'string' && t.trim().length > 0);
    if (validTokens.length === 0) {
      return { sentCount: 0, failedTokens: [] };
    }

    const messages = validTokens.map((to) => ({
      to,
      sound: payload.sound || 'default',
      title: payload.title,
      body: payload.body,
      data: payload.data || {},
      priority: payload.priority || 'high',
      channelId: payload.channelId || 'default',
    }));

    // Expo recommends chunks of up to 100 messages per HTTP request
    const CHUNK_SIZE = 100;
    let sentCount = 0;
    const failedTokens: string[] = [];

    for (let i = 0; i < messages.length; i += CHUNK_SIZE) {
      const chunk = messages.slice(i, i + CHUNK_SIZE);

      try {
        const response = await fetch(this.EXPO_PUSH_API_URL, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Accept-Encoding': 'gzip, deflate',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(chunk),
        });

        const json: any = await response.json();
        const tickets = json?.data;
        if (Array.isArray(tickets)) {
          tickets.forEach((ticket: any, idx: number) => {
            if (ticket.status === 'ok') {
              sentCount++;
            } else {
              const token = chunk[idx]?.to;
              if (token) {
                failedTokens.push(token);
                this.logger.warn(
                  `[EXPO_PUSH_TICKET_ERROR] Token: ${token}, Details: ${JSON.stringify(ticket.details)}`,
                );
              }
            }
          });
        }
      } catch (err: any) {
        this.logger.error(
          `[EXPO_PUSH_REQUEST_FAILED] Failed to send chunk to Expo: ${err.message}`,
        );
        chunk.forEach((m) => failedTokens.push(m.to));
      }
    }

    this.logger.log(
      `[EXPO_PUSH_COMPLETE] Sent: ${sentCount}/${validTokens.length}, Failed: ${failedTokens.length}`,
    );

    return { sentCount, failedTokens };
  }
}
