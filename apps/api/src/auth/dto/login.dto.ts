import { IsNotEmpty, IsString, Length, Matches } from 'class-validator';
import { ETHIOPIAN_MOBILE_MESSAGE, ETHIOPIAN_MOBILE_PATTERN } from './ethiopian-phone.js';

/** DTO for the login endpoint — phone number + OTP code */
export class LoginDto {
  @Matches(ETHIOPIAN_MOBILE_PATTERN, { message: ETHIOPIAN_MOBILE_MESSAGE })
  phone: string;

  @IsString()
  @IsNotEmpty()
  @Length(4, 8)
  code: string;
}
