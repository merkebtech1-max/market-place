import { Injectable } from '@nestjs/common';
import { CloudflareR2Service } from './cloudflare-r2.service.js';
import { LocalStorageService } from './local-storage.service.js';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class StorageService {
  private readonly provider: 'local' | 'r2';

  constructor(
    private readonly cloudflareR2: CloudflareR2Service,
    private readonly local: LocalStorageService,
    config: ConfigService,
  ) {
    const defaultProvider = config.get<string>('NODE_ENV', 'development') === 'production' ? 'r2' : 'local';
    this.provider = config.get<'local' | 'r2'>('STORAGE_PROVIDER', defaultProvider);
  }

  async upload(
    storageKey: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<void> {
    return this.provider === 'local'
      ? this.local.upload(storageKey, buffer)
      : this.cloudflareR2.upload(storageKey, buffer, contentType);
  }

  async delete(storageKey: string): Promise<void> {
    return this.provider === 'local'
      ? this.local.delete(storageKey)
      : this.cloudflareR2.delete(storageKey);
  }

  async readLocal(storageKey: string) {
    return this.local.read(storageKey);
  }
}
