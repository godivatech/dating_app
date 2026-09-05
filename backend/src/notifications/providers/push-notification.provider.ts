import { Injectable, Logger } from '@nestjs/common';

export const PUSH_NOTIFICATION_PROVIDER = 'PUSH_NOTIFICATION_PROVIDER';

export interface PushNotificationPayload {
  title: string;
  body: string;
  data?: Record<string, any>;
}

export interface PushNotificationProvider {
  sendPush(
    tokens: string[],
    payload: PushNotificationPayload,
  ): Promise<{ sentCount: number; failedTokens: string[] }>;
}

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
