import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Min, IsObject } from 'class-validator';
import { ListingCondition } from '../../generated/prisma/enums.js';

/** DTO for updating an existing listing (draft only) */
export class UpdateListingDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  title?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  description?: string;

  @IsOptional()
  @IsEnum(ListingCondition)
  condition?: ListingCondition;

  @IsOptional()
  @IsInt()
  @Min(0)
  priceCents?: number;

  @IsOptional()
  isNegotiable?: boolean;

  @IsOptional()
  @IsObject()
  attributes?: Record<string, any>;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsUUID()
  cityId?: string;

  @IsOptional()
  @IsUUID()
  subcityId?: string;

  @IsOptional()
  @IsString()
  landmark?: string;
}
