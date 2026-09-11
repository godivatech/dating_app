import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { BillingController } from './billing.controller';
import { EntitlementService } from './services/entitlement.service';
import { SubscriptionService } from './services/subscription.service';
import { PurchaseService } from './services/purchase.service';
import { CreditService } from './services/credit.service';
import { PURCHASE_PROVIDER } from './providers/purchase-provider.interface';
import { MockPurchaseProvider } from './providers/mock-purchase-provider';

@Module({
  imports: [PrismaModule, RedisModule],
  controllers: [BillingController],
  providers: [
    EntitlementService,
    SubscriptionService,
    PurchaseService,
    CreditService,
    {
      provide: PURCHASE_PROVIDER,
      useClass: MockPurchaseProvider,
    },
  ],
  exports: [EntitlementService, SubscriptionService, PurchaseService, CreditService],
})
export class BillingModule {}
