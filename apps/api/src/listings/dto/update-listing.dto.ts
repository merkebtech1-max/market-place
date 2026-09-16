import { IsEnum, IsInt, IsJSON, IsNotEmpty, IsOptional, IsString, IsUUID, Min } from 'class-validator';
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
  @IsJSON()
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
