import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ReservationLifecycleService } from '../../transactions/services/reservation-lifecycle.service.js';
import { RESERVATION_EXPIRY_QUEUE } from '../queues/reservation-expiry.queue.js';

/**
 * Receives reservation-expiry jobs and delegates to the lifecycle service.
 *
 * This processor is orchestration only — it contains no Prisma queries and
 * no reservation state-transition rules. QR completion and automatic expiry
 * are two triggers over the same ReservationLifecycleService ownership.
 */
@Processor(RESERVATION_EXPIRY_QUEUE)
export class ReservationExpiryProcessor extends WorkerHost {
  private readonly logger = new Logger(ReservationExpiryProcessor.name);

  constructor(private readonly lifecycle: ReservationLifecycleService) {
    super();
  }

  async process(job: Job): Promise<{ found: number; completed: number; skipped: number; failed: number }> {
    this.logger.log(`Received ${job.name || 'reservation-expiry'} job id=${job.id}`);

    const result = await this.lifecycle.processExpiredReservations();

    this.logger.log(
      `Reservation expiry job finished: found=${result.found} completed=${result.completed} skipped=${result.skipped} failed=${result.failed}`,
    );

    return result;
  }
}
