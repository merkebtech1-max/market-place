import { IsNotEmpty, IsPhoneNumber, IsString, Length } from 'class-validator';

/** DTO for the login endpoint — phone number + OTP code */
export class LoginDto {
  @IsPhoneNumber()
  phone: string;

  @IsString()
  @IsNotEmpty()
  @Length(4, 8)
  code: string;
}
