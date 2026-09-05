import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ISmsService } from './sms.service.interface';

@Injectable()
export class MockSmsService implements ISmsService {
  private readonly logger = new Logger(MockSmsService.name);

  constructor(private readonly configService: ConfigService) {}

  async sendOtp(phoneNumber: string, otp: string): Promise<void> {
    const nodeEnv = this.configService.get<string>('NODE_ENV') || 'development';
    const maskedPhone = this.maskPhoneNumber(phoneNumber);

    if (nodeEnv !== 'production') {
      // In development/test mode, log clearly for manual testing without sending real SMS
      this.logger.log(`[DEV_OTP_DISPATCH] Sent OTP [${otp}] to ${maskedPhone}`);
    } else {
      // In production mode, never log the actual OTP
      this.logger.log(`[SMS_DISPATCH] OTP dispatched to ${maskedPhone}`);
    }
    await Promise.resolve();
  }

  private maskPhoneNumber(phone: string): string {
    if (phone.length <= 6) return phone;
    const prefix = phone.slice(0, 4);
    const suffix = phone.slice(-4);
    return `${prefix}****${suffix}`;
  }
}
