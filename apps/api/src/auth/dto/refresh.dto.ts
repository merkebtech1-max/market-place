import { IsNotEmpty, IsString } from 'class-validator';

/** DTO for the refresh token endpoint — refresh token */
export class RefreshDto {
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}
