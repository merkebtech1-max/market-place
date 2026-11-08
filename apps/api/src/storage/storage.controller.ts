import { Controller, Get, Param, StreamableFile } from '@nestjs/common';
import { StorageService } from './storage.service.js';

@Controller('storage')
export class StorageController {
  constructor(private readonly storage: StorageService) {}

  @Get('listings/:listingId/:fileName')
  async listingImage(
    @Param('listingId') listingId: string,
    @Param('fileName') fileName: string,
  ) {
    const file = await this.storage.readLocal(`listings/${listingId}/${fileName}`);
    return new StreamableFile(file.buffer, { type: file.contentType });
  }
}
