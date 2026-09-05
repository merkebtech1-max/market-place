import { IsNotEmpty, IsOptional, IsPhoneNumber, IsString, IsUUID, Length } from 'class-validator';

/** DTO for the register endpoint — OTP-verified phone + user profile fields */
export class RegisterDto {
  @IsPhoneNumber()
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
