import { Module } from '@nestjs/common';
import { TransactionsModule } from '../transactions/transactions.module.js';

@Module({
  imports: [
    TransactionsModule,

    // TODO: BullMQ root configuration — Redis connection.
    // Add once the Redis service exists (docker-compose).
    // Expected configuration via environment variables:
    //   REDIS_HOST (likely the compose service name, e.g. "redis")
    //   REDIS_PORT
    //
    // BullModule.forRoot({
    //   connection: {
    //     host: process.env.REDIS_HOST,
    //     port: Number(process.env.REDIS_PORT),
    //   },
    // }),

    // TODO: register the reservation-expiry queue once Redis exists.
    // Registering the queue without a configured root connection would
    // still make BullMQ fall back to its default localhost:6379 attempt.
    //
    // BullModule.registerQueue({
    //   name: RESERVATION_EXPIRY_QUEUE,
    // }),

    // TODO: add the recurring reservation-expiry job once Redis is
    // available — recommended initial interval: every 5 minutes.
  ],
  // TODO: enabling ReservationExpiryProcessor as a provider requires the
  // BullModule root config + queue registration above. Until then Nest
  // cannot instantiate a @Processor bound to a queue that isn't registered,
  // so it stays commented out to avoid any Redis connection attempt.
  providers: [],
})
export class JobsModule {}
