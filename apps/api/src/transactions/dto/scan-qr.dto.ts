import { IsNotEmpty, IsString } from 'class-validator';

/** Input for scanning a buyer's QR token. Business validation lives in the service. */
export class ScanQrDto {
  @IsString()
  @IsNotEmpty({ message: 'token is required' })
  token: string;
}
