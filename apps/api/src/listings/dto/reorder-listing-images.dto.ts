import { ArrayNotEmpty, IsArray, IsString } from 'class-validator';

/** DTO for reordering a listing's images */
export class ReorderListingImagesDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  imageIds: string[];
}