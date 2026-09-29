import { Module } from '@nestjs/common';
import { CloudflareR2Service } from './cloudflare-r2.service.js';
import { StorageService } from './storage.service.js';

@Module({
  providers: [CloudflareR2Service, StorageService],
  exports: [StorageService],
})
export class StorageModule {}
