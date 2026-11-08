import { Module } from '@nestjs/common';
import { CloudflareR2Service } from './cloudflare-r2.service.js';
import { StorageService } from './storage.service.js';
import { LocalStorageService } from './local-storage.service.js';
import { StorageController } from './storage.controller.js';

@Module({
  controllers: [StorageController],
  providers: [CloudflareR2Service, LocalStorageService, StorageService],
  exports: [StorageService],
})
export class StorageModule {}
