import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RtcTokenBuilder, RtcRole } from 'agora-token';

@Injectable()
export class AgoraTokenService {
  private readonly logger = new Logger(AgoraTokenService.name);
  private readonly appId: string;
  private readonly appCertificate: string;

  constructor(private readonly configService: ConfigService) {
    this.appId = this.configService.get<string>('AGORA_APP_ID') || '';
    this.appCertificate = this.configService.get<string>('AGORA_APP_CERTIFICATE') || '';

    if (!this.appId || !this.appCertificate) {
      this.logger.warn(
        '[AGORA_CONFIG_WARN] AGORA_APP_ID or AGORA_APP_CERTIFICATE not set in environment. Mock RTC tokens will be issued for safe development and local testing.',
      );
    }
  }

  /**
   * Generates a short-lived Agora RTC Token with channel and numeric UID binding.
   */
  generateRtcToken(
    channelName: string,
    uid: number,
    role: number = RtcRole.PUBLISHER,
    expireSeconds: number = 3600,
  ): { token: string; expiresAt: number } {
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = currentTimestamp + expireSeconds;

    if (!this.appId || !this.appCertificate) {
      const devToken = `mock_rtc_token_${channelName}_uid${uid}_exp${privilegeExpiredTs}`;
      return { token: devToken, expiresAt: privilegeExpiredTs };
    }

    try {
      const token = RtcTokenBuilder.buildTokenWithUid(
        this.appId,
        this.appCertificate,
        channelName,
        uid,
        role,
        expireSeconds,
        privilegeExpiredTs,
      );

      return { token, expiresAt: privilegeExpiredTs };
    } catch (error: any) {
      this.logger.error(`Failed to generate Agora token: ${error.message}`);
      return {
        token: `fallback_rtc_token_${channelName}_${Date.now()}`,
        expiresAt: privilegeExpiredTs,
      };
    }
  }
}
