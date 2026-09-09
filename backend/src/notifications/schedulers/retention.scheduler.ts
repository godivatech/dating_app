import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RetentionService, RetentionRunResult } from '../services/retention.service';

@Injectable()
export class RetentionScheduler {
  private readonly logger = new Logger(RetentionScheduler.name);
  private isProcessing = false;

  constructor(private readonly retentionService: RetentionService) {}

  /**
   * Prime Lunchtime Campaign: 1:00 PM IST (07:30 UTC)
   * High user check-in rate during lunch break.
   */
  @Cron('30 7 * * *')
  async handleLunchtimeRetention(): Promise<void> {
    this.logger.log('[CRON_START] Executing 1:00 PM IST Lunchtime Retention Campaign...');
    await this.safeExecute();
  }

  /**
   * Prime Evening Campaign: 7:30 PM IST (14:00 UTC)
   * Peak dating app activity window in India (7:00 PM - 10:00 PM).
   */
  @Cron('0 14 * * *')
  async handleEveningRetention(): Promise<void> {
    this.logger.log('[CRON_START] Executing 7:30 PM IST Evening Leisure Retention Campaign...');
    await this.safeExecute();
  }

  /**
   * Safe execution wrapper with concurrency guard to prevent overlapping cron runs.
   */
  async safeExecute(force = false): Promise<RetentionRunResult | null> {
    if (this.isProcessing) {
      this.logger.warn('[CRON_BUSY] Retention job already executing; skipping cycle.');
      return null;
    }

    this.isProcessing = true;
    try {
      return await this.retentionService.runRetentionCampaigns(force);
    } catch (err: any) {
      this.logger.error(`[CRON_FAILED] Retention campaign execution error: ${err.message}`, err.stack);
      return null;
    } finally {
      this.isProcessing = false;
    }
  }
}
