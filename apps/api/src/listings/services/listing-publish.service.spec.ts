import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ListingPublishService } from './listing-publish.service.js';
import { ListingValidationService } from './listing-validation.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ListingStatus } from '../../generated/prisma/enums.js';

describe('ListingPublishService', () => {
  let service: ListingPublishService;

  const prismaMock = {
    listing: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  };

  const validationMock = {
    validateActiveSeller: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListingPublishService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: ListingValidationService, useValue: validationMock },
      ],
    }).compile();

    service = module.get<ListingPublishService>(ListingPublishService);

    // $transaction runs the callback against a tx alias of the mocked client.
    prismaMock.$transaction.mockImplementation(async (callback: (tx: any) => Promise<unknown>) => callback(prismaMock));
  });

  function mockListingRow(sellerId: string, status: ListingStatus, imageCount: number) {
    prismaMock.listing.findUnique.mockResolvedValue({
      id: 'listing-1',
      sellerId,
      status,
      _count: { images: imageCount },
    });
  }

  function mockSuccessfulUpdate() {
    prismaMock.listing.update.mockResolvedValue({
      id: 'listing-1',
      status: ListingStatus.ACTIVE,
      publishedAt: new Date(),
      expiresAt: new Date(),
    });
  }

  it('rejects publishing a draft listing with 0 images', async () => {
    mockListingRow('seller-1', ListingStatus.DRAFT, 0);

    await expect(service.publishListing('listing-1', 'seller-1', {})).rejects.toThrow(BadRequestException);
    expect(prismaMock.listing.update).not.toHaveBeenCalled();
  });

  it('publishes a draft listing with 1 image', async () => {
    mockListingRow('seller-1', ListingStatus.DRAFT, 1);
    mockSuccessfulUpdate();

    await expect(service.publishListing('listing-1', 'seller-1', {})).resolves.toMatchObject({
      listingId: 'listing-1',
      status: ListingStatus.ACTIVE,
    });
    expect(prismaMock.listing.update).toHaveBeenCalledTimes(1);
  });

  it('publishes a draft listing with 5 images', async () => {
    mockListingRow('seller-1', ListingStatus.DRAFT, 5);
    mockSuccessfulUpdate();

    await expect(service.publishListing('listing-1', 'seller-1', {})).resolves.toMatchObject({
      listingId: 'listing-1',
      status: ListingStatus.ACTIVE,
    });
  });

  it('publishes a draft listing even with more images than the upload max, as that cap is enforced upstream', async () => {
    mockListingRow('seller-1', ListingStatus.DRAFT, 6);
    mockSuccessfulUpdate();

    await expect(service.publishListing('listing-1', 'seller-1', {})).resolves.toMatchObject({
      listingId: 'listing-1',
      status: ListingStatus.ACTIVE,
    });
  });

  it('rejects a non-owner publishing someone else\'s listing', async () => {
    mockListingRow('seller-other', ListingStatus.DRAFT, 3);

    await expect(service.publishListing('listing-1', 'seller-1', {})).rejects.toThrow(ForbiddenException);
    expect(prismaMock.listing.update).not.toHaveBeenCalled();
  });

  it('keeps rejecting listings that are no longer drafts', async () => {
    mockListingRow('seller-1', ListingStatus.ACTIVE, 3);

    await expect(service.publishListing('listing-1', 'seller-1', {})).rejects.toThrow(BadRequestException);
    expect(prismaMock.listing.update).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when the listing does not exist', async () => {
    prismaMock.listing.findUnique.mockResolvedValue(null);

    await expect(service.publishListing('missing', 'seller-1', {})).rejects.toThrow(NotFoundException);
    expect(prismaMock.listing.update).not.toHaveBeenCalled();
  });
});