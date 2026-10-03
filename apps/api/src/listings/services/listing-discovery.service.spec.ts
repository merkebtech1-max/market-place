import { Test, TestingModule } from '@nestjs/testing';
import { ListingDiscoveryService } from './listing-discovery.service.js';
import { ListingSearchService } from './listing-search.service.js';
import { ListingFeedService } from './listing-feed.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ListingSort } from '../dto/listing-query.dto.js';

function cardRow(id: string) {
  return {
    id,
    title: `Listing ${id}`,
    priceCents: 1000,
    condition: 'GOOD',
    isNegotiable: false,
    publishedAt: new Date(),
    images: [],
    category: { id: 'cat-1', nameEn: 'Cars', nameAm: 'Mekina', slug: 'cars' },
    city: { id: 'city-1', nameEn: 'Addis Ababa', nameAm: 'Addis' },
    subcity: null,
    seller: { id: 'seller-1', displayName: 'Seller', avatarKey: null, ratingAvg: '4.5', ratingCount: 7 },
  };
}

describe('ListingDiscoveryService (isSaved)', () => {
  let service: ListingDiscoveryService;

  const prismaMock = {
    listing: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    savedListing: {
      findMany: vi.fn(),
    },
  };

  const searchMock = {
    resolveLocationIds: vi.fn().mockResolvedValue({ cityId: undefined, subcityId: undefined }),
  };

  const feedMock = {};

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListingDiscoveryService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: ListingSearchService, useValue: searchMock },
        { provide: ListingFeedService, useValue: feedMock },
      ],
    }).compile();

    service = module.get<ListingDiscoveryService>(ListingDiscoveryService);
  });

  it('flags no cards as saved and skips the saved query for anonymous users', async () => {
    prismaMock.listing.count.mockResolvedValue(3);
    prismaMock.listing.findMany.mockResolvedValue([cardRow('a'), cardRow('b'), cardRow('c')]);

    const result = await service.getListings({ page: 1, limit: 10 } as never);

    expect(prismaMock.savedListing.findMany).not.toHaveBeenCalled();
    expect(result.data.map((card) => card.isSaved)).toEqual([false, false, false]);
  });

  it('performs one batch saved query per page and flags cards accordingly', async () => {
    prismaMock.listing.count.mockResolvedValue(3);
    prismaMock.listing.findMany.mockResolvedValue([cardRow('a'), cardRow('b'), cardRow('c')]);
    prismaMock.savedListing.findMany.mockResolvedValue([{ listingId: 'a' }, { listingId: 'c' }]);

    const result = await service.getListings(
      { page: 1, limit: 10, sort: ListingSort.NEWEST } as never,
      'user-1',
      'user-1',
    );

    expect(prismaMock.savedListing.findMany).toHaveBeenCalledTimes(1);
    expect(prismaMock.savedListing.findMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', listingId: { in: ['a', 'b', 'c'] } },
      select: { listingId: true },
    });
    expect(result.data.map((card) => ({ id: card.id, isSaved: card.isSaved }))).toEqual([
      { id: 'a', isSaved: true },
      { id: 'b', isSaved: false },
      { id: 'c', isSaved: true },
    ]);
  });
});