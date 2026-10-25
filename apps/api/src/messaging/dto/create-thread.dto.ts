import { IsUUID } from 'class-validator';

/** DTO for opening a conversation about a listing. The buyer always comes
 * from the authenticated JWT — never from the client. */
export class CreateThreadDto {
  @IsUUID()
  listingId: string;
}