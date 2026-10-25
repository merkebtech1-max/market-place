/**
 * Name of the single queue that represents reservation-expiry background work.
 *
 * One queue per type of work — not one queue per reservation. Later a
 * recurring job will be enqueued here every ~5 minutes.
 */
export const RESERVATION_EXPIRY_QUEUE = 'reservation-expiry';

// TODO:
// - Add the recurring BullMQ job for this queue (repeat: { every: 5 min }).
// - Recommended initial interval: every 5 minutes.
// - Enable scheduling only after the Redis connection is available.
