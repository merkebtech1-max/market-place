import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service.js';
import { StorageService } from '../../storage/storage.service.js';
import { ListingStatus } from '../../generated/prisma/enums.js';
import { ListingImageModel } from '../../generated/prisma/models/ListingImage.js';
import {
  ALLOWED_LISTING_IMAGE_EXTENSIONS,
  ALLOWED_LISTING_IMAGE_TYPES,
  AllowedListingImageType,
  MAX_LISTING_IMAGES,
  MAX_LISTING_IMAGE_SIZE,
} from '../constants/listing-image.constants.js';

/** Optional metadata captured at upload time */
export interface ListingImageMeta {
  width?: number;
  height?: number;
  blurhash?: string;
  phash?: string;
}

/** A decoded file to upload */
export interface UploadFile {
  buffer: Buffer;
  mimetype: string;
  size: number;
}

/**
 * Owns listing image lifecycle: upload (with R2 orphan cleanup), delete,
 * and reorder. Positions are 0-indexed and kept consecutive (0..n-1); uploads
 * always append at the end.
 */
@Injectable()
export class ListingImageService {
  private readonly logger = new Logger(ListingImageService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async addImage(
    listingId: string,
    sellerId: string,
    file: UploadFile,
    meta: ListingImageMeta = {},
  ): Promise<ListingImageModel> {
    this.logger.log(`[START] Adding image to listing=${listingId} by seller=${sellerId}`);

    try {
      await this.assertEditableAndOwned(listingId, sellerId);

      if (!this.isAllowedType(file.mimetype)) {
        throw new BadRequestException(`Only ${ALLOWED_LISTING_IMAGE_TYPES.join(', ')} images are allowed.`);
      }
      if (file.size > MAX_LISTING_IMAGE_SIZE) {
        throw new BadRequestException(`Image must be ${MAX_LISTING_IMAGE_SIZE / (1024 * 1024)}MB or smaller.`);
      }

      const existingCount = await this.prisma.listingImage.count({ where: { listingId } });
      if (existingCount >= MAX_LISTING_IMAGES) {
        throw new BadRequestException(`A listing can have at most ${MAX_LISTING_IMAGES} images.`);
      }

      const storageKey = this.buildStorageKey(listingId, file.mimetype);
      await this.storage.upload(storageKey, file.buffer, file.mimetype);

      try {
        const image = await this.prisma.listingImage.create({
          data: {
            listingId,
            storageKey,
            position: existingCount,
            width: meta.width ?? null,
            height: meta.height ?? null,
            blurhash: meta.blurhash ?? null,
            phash: meta.phash ?? null,
          },
        });

        this.logger.log(`[SUCCESS] Image added: imageId=${image.id}, listingId=${listingId}, storageKey=${storageKey}, position=${image.position}`);
        return image;
      } catch (error) {
        // R2 upload already succeeded — remove the object so it doesn't orphan.
        this.logger.error(
          `[ERROR] DB write failed after storage upload for listing=${listingId}, storageKey=${storageKey} - ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
        await this.deleteOrphanObject(storageKey);
        throw new BadRequestException('Unable to save your image at this time. Please try again later.');
      }
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException ||
        error instanceof BadRequestException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }
      this.logger.error(
        `[ERROR] Failed to add image to listing=${listingId} - ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new BadRequestException('Unable to add your image at this time. Please try again later.');
    }
  }

  async deleteImage(listingId: string, sellerId: string, imageId: string): Promise<void> {
    this.logger.log(`[START] Deleting image=${imageId} from listing=${listingId} by seller=${sellerId}`);

    try {
      await this.assertEditableAndOwned(listingId, sellerId);

      const image = await this.prisma.listingImage.findFirst({ where: { id: imageId, listingId } });
      if (!image) {
        throw new NotFoundException(`Image with ID ${imageId} not found on listing ${listingId}.`);
      }

      const count = await this.prisma.listingImage.count({ where: { listingId } });
      if (count <= 1) {
        throw new BadRequestException('A listing must keep at least one image.');
      }

      // Atomically remove the row and renumber the survivors so positions stay 0..n-1.
      await this.prisma.$transaction(async (tx) => {
        await tx.listingImage.delete({ where: { id: imageId } });

        const remaining = await tx.listingImage.findMany({
          where: { listingId },
          orderBy: { position: 'asc' },
          select: { id: true },
        });
        for (let index = 0; index < remaining.length; index += 1) {
          await tx.listingImage.update({
            where: { id: remaining[index].id },
            data: { position: index },
          });
        }
      });

      // Best-effort object cleanup — the DB reference is already gone.
      try {
        await this.storage.delete(image.storageKey);
      } catch (cleanupError) {
        this.logger.error(
          `[CLEANUP] Failed to delete R2 object for removed image: storageKey=${image.storageKey} - ${cleanupError instanceof Error ? cleanupError.message : 'Unknown error'}`,
        );
      }

      this.logger.log(`[SUCCESS] Image deleted: imageId=${imageId}, listingId=${listingId}`);
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException ||
        error instanceof BadRequestException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }
      this.logger.error(
        `[ERROR] Failed to delete image=${imageId} from listing=${listingId} - ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new BadRequestException('Unable to delete your image at this time. Please try again later.');
    }
  }

  async reorderImages(listingId: string, sellerId: string, orderedIds: string[]): Promise<ListingImageModel[]> {
    this.logger.log(`[START] Reordering images for listing=${listingId} by seller=${sellerId}`);

    try {
      await this.assertEditableAndOwned(listingId, sellerId);

      const existing = await this.prisma.listingImage.findMany({
        where: { listingId },
        orderBy: { position: 'asc' },
      });

      if (existing.length === 0) {
        throw new BadRequestException('This listing has no images to reorder.');
      }
      if (orderedIds.length !== existing.length) {
        throw new BadRequestException('The new order must include every image of the listing exactly once.');
      }

      const existingIds = new Set(existing.map((img) => img.id));
      for (const id of orderedIds) {
        if (!existingIds.has(id)) {
          throw new BadRequestException(`Image with ID ${id} is not part of this listing.`);
        }
      }
      if (new Set(orderedIds).size !== orderedIds.length) {
        throw new BadRequestException('The new order contains duplicate images.');
      }

      const updated = await this.prisma.$transaction(
        orderedIds.map((id, index) =>
          this.prisma.listingImage.update({ where: { id }, data: { position: index } }),
        ),
      );

      this.logger.log(`[SUCCESS] Images reordered: listingId=${listingId}, count=${updated.length}`);
      return updated;
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException ||
        error instanceof BadRequestException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }
      this.logger.error(
        `[ERROR] Failed to reorder images for listing=${listingId} - ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new BadRequestException('Unable to reorder your images at this time. Please try again later.');
    }
  }

  private async assertEditableAndOwned(listingId: string, sellerId: string): Promise<void> {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      select: { sellerId: true, status: true },
    });

    if (!listing) throw new NotFoundException(`Listing with ID ${listingId} not found.`);
    if (listing.sellerId !== sellerId) {
      throw new ForbiddenException('You can only manage images on your own listings.');
    }
    if (listing.status !== ListingStatus.DRAFT) {
      throw new BadRequestException('Only draft listings can be edited. This listing has already been published or has a different status.');
    }
  }

  private isAllowedType(mimetype: string): boolean {
    return (ALLOWED_LISTING_IMAGE_TYPES as readonly string[]).includes(mimetype);
  }

  private buildStorageKey(listingId: string, mimetype: string): string {
    const extension = ALLOWED_LISTING_IMAGE_EXTENSIONS[mimetype as AllowedListingImageType];
    return `listings/${listingId}/${randomUUID()}.${extension}`;
  }

  private async deleteOrphanObject(storageKey: string): Promise<void> {
    try {
      await this.storage.delete(storageKey);
      this.logger.log(`[CLEANUP] Deleted orphan R2 object after failed DB write: storageKey=${storageKey}`);
    } catch (cleanupError) {
      this.logger.error(
        `[CLEANUP] Orphan R2 object remains after failed cleanup: storageKey=${storageKey} - ${cleanupError instanceof Error ? cleanupError.message : 'Unknown error'}`,
      );
    }
  }
}
