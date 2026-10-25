import { IsBoolean, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Min, IsObject } from 'class-validator';
import { ListingCondition } from '../../generated/prisma/enums.js';

/** DTO for creating a new listing draft */
export class CreateListingDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsEnum(ListingCondition)
  condition: ListingCondition;

  @IsInt()
  @Min(0)
  priceCents: number;

  @IsOptional()
  @IsBoolean()
  isNegotiable?: boolean;

  @IsOptional()
  @IsObject()
  attributes?: Record<string, any>;

  @IsUUID()
  @IsNotEmpty()
  categoryId: string;

  @IsUUID()
  @IsNotEmpty()
  cityId: string;

  @IsUUID()
  @IsOptional()
  subcityId?: string;

  @IsOptional()
  @IsString()
  landmark?: string;
}
