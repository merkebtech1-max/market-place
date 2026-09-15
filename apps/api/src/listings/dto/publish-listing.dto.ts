import { IsArray, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

/** DTO for listing image during publish */
export class ListingImageDto {
  @IsUUID()
  storageKey: string;

  @IsOptional()
  width?: number;

  @IsOptional()
  height?: number;

  @IsOptional()
  blurhash?: string;

  @IsOptional()
  phash?: string;

  @IsOptional()
  position?: number;
}

/** DTO for publishing a listing */
export class PublishListingDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ListingImageDto)
  images: ListingImageDto[];
}
