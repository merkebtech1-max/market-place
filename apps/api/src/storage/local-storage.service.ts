import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, extname, isAbsolute, resolve, sep } from 'node:path';

const CONTENT_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

@Injectable()
export class LocalStorageService {
  private readonly root: string;

  constructor(config: ConfigService) {
    this.root = resolve(process.cwd(), config.get<string>('LOCAL_STORAGE_PATH', '.local-storage'));
  }

  private pathFor(storageKey: string) {
    const normalized = storageKey.replaceAll('\\', '/');
    if (isAbsolute(normalized) || normalized.split('/').some((part) => part === '..')) {
      throw new InternalServerErrorException('Invalid storage key.');
    }
    const target = resolve(this.root, ...normalized.split('/'));
    if (!target.startsWith(`${this.root}${sep}`)) {
      throw new InternalServerErrorException('Invalid storage key.');
    }
    return target;
  }

  async upload(storageKey: string, buffer: Buffer): Promise<void> {
    const target = this.pathFor(storageKey);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, buffer);
  }

  async delete(storageKey: string): Promise<void> {
    await rm(this.pathFor(storageKey), { force: true });
  }

  async read(storageKey: string): Promise<{ buffer: Buffer; contentType: string }> {
    try {
      const target = this.pathFor(storageKey);
      return {
        buffer: await readFile(target),
        contentType: CONTENT_TYPES[extname(target).toLowerCase()] ?? 'application/octet-stream',
      };
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw new NotFoundException('Image not found.');
      throw error;
    }
  }
}
