import { Injectable } from '@nestjs/common';
import { CloudflareR2Service } from './cloudflare-r2.service.js';

@Injectable()
export class StorageService {
  constructor(
    private readonly cloudflareR2: CloudflareR2Service,
  ) {}

  async upload(
    storageKey: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<void> {
    return this.cloudflareR2.upload(storageKey, buffer, contentType);
  }

  async delete(storageKey: string): Promise<void> {
    return this.cloudflareR2.delete(storageKey);
  }
}
