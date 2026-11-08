import { IsNotEmpty, IsOptional, IsString, IsUUID, Length, Matches } from 'class-validator';
import { ETHIOPIAN_MOBILE_MESSAGE, ETHIOPIAN_MOBILE_PATTERN } from './ethiopian-phone.js';

/** DTO for the register endpoint — OTP-verified phone + user profile fields */
export class RegisterDto {
  @Matches(ETHIOPIAN_MOBILE_PATTERN, { message: ETHIOPIAN_MOBILE_MESSAGE })
  phone: string;

  @IsString()
  @IsNotEmpty()
  @Length(4, 8)
  code: string;

  @IsString()
  @IsNotEmpty()
  displayName: string;

  @IsString()
  @IsOptional()
  bio?: string;

  @IsUUID()
  @IsOptional()
  cityId?: string;

  @IsUUID()
  @IsOptional()
  subcityId?: string;
}
