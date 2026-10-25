import { IsUUID } from 'class-validator';

/**
 * Input for creating a reservation.
 *
 * The buyer must have an existing conversation thread with the seller.
 * All other values (buyerId, sellerId, status, price, commission,
 * payment status, expiration) are server-owned and derived from the
 * JWT, the Listing, the Thread, and backend configuration.
 */
export class CreateReservationDto {
  @IsUUID('4', { message: 'listingId must be a valid UUID' })
  listingId: string;

  @IsUUID('4', { message: 'threadId must be a valid UUID' })
  threadId: string;
}
