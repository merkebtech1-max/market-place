import { IsEnum, IsInt, IsJSON, IsNotEmpty, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { ListingCondition } from '../../../generated/prisma/enums/ListingCondition.js';

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
  isNegotiable?: boolean;

  @IsOptional()
  @IsJSON()
  attributes?: Record<string, any>;

  @IsUUID()
  @IsNotEmpty()
  categoryId: string;

  @IsUUID()
  @IsNotEmpty()
  cityId: string;

  @IsOptional()
  @IsUUID()
  subcityId?: string;

  @IsOptional()
  @IsString()
  landmark?: string;
}
