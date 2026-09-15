import { PartialType } from '@nestjs/mapped-types';
import { CreateListingDto } from './create-listing.dto.js';

/** DTO for updating an existing listing (draft only) */
export class UpdateListingDto extends PartialType(CreateListingDto) {}
