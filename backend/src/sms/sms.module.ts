import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SMS_SERVICE } from './sms.service.interface';
import { MockSmsService } from './mock-sms.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: SMS_SERVICE,
      useFactory: (configService: ConfigService) => {
        // Extendable for future production providers (e.g. Twilio, MSG91, AWS SNS)
        return new MockSmsService(configService);
      },
      inject: [ConfigService],
    },
  ],
  exports: [SMS_SERVICE],
})
export class SmsModule {}
