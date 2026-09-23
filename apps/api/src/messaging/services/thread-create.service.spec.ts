import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ThreadCreateService } from './thread-create.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Prisma } from '../../generated/prisma/client.js';
import { ListingStatus, UserStatus } from '../../generated/prisma/enums.js';

describe('ThreadCreateService', () => {
  let service: ThreadCreateService;

  const prismaMock = {
    listing: { findUnique: vi.fn() },
    user: { findUnique: vi.fn() },
    thread: { findUnique: vi.fn(), create: vi.fn() },
  };

  const threadRow = {
    id: 'thread-1',
    listingId: 'listing-1',
    buyerId: 'buyer-1',
    sellerId: 'seller-1',
    unlockedAt: null,
    lastMessageAt: null,
    createdAt: new Date(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ThreadCreateService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<ThreadCreateService>(ThreadCreateService);
  });

  function mockActiveListing(sellerId = 'seller-1') {
    prismaMock.listing.findUnique.mockResolvedValue({
      id: 'listing-1',
      sellerId,
      status: ListingStatus.ACTIVE,
      expiresAt: new Date(Date.now() + 86_400_000),
      seller: { status: UserStatus.ACTIVE },
    });
  }

  function mockActiveBuyer() {
    prismaMock.user.findUnique.mockResolvedValue({ id: 'buyer-1', status: UserStatus.ACTIVE });
  }

  it('returns the existing thread instead of creating a duplicate', async () => {
    mockActiveListing();
    mockActiveBuyer();
    prismaMock.thread.findUnique.mockResolvedValue(threadRow);

    await expect(service.createThread('listing-1', 'buyer-1')).resolves.toEqual(threadRow);
    expect(prismaMock.thread.create).not.toHaveBeenCalled();
  });

  it('creates the thread for an active, unexpired listing from an active buyer', async () => {
    mockActiveListing();
    mockActiveBuyer();
    prismaMock.thread.findUnique.mockResolvedValue(null);
    prismaMock.thread.create.mockResolvedValue(threadRow);

    await expect(service.createThread('listing-1', 'buyer-1')).resolves.toEqual(threadRow);
    expect(prismaMock.thread.create).toHaveBeenCalledWith({
      data: { listingId: 'listing-1', buyerId: 'buyer-1', sellerId: 'seller-1' },
      select: expect.any(Object),
    });
  });

  it('returns the thread that won the P2002 race instead of failing', async () => {
    mockActiveListing();
    mockActiveBuyer();
    prismaMock.thread.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(threadRow);
    const raceError = Object.create(Prisma.PrismaClientKnownRequestError.prototype) as Prisma.PrismaClientKnownRequestError;
    Object.assign(raceError, { code: 'P2002', message: 'Unique constraint failed on the fields: (`listingId`,`buyerId`)' });
    prismaMock.thread.create.mockRejectedValue(raceError);

    await expect(service.createThread('listing-1', 'buyer-1')).resolves.toEqual(threadRow);
    expect(prismaMock.thread.findUnique).toHaveBeenCalledTimes(2);
  });

  it('throws NotFoundException when the listing does not exist', async () => {
    prismaMock.listing.findUnique.mockResolvedValue(null);

    await expect(service.createThread('missing', 'buyer-1')).rejects.toThrow(NotFoundException);
    expect(prismaMock.thread.create).not.toHaveBeenCalled();
  });

  it('rejects a listing that is not ACTIVE', async () => {
    prismaMock.listing.findUnique.mockResolvedValue({
      id: 'listing-1',
      sellerId: 'seller-1',
      status: ListingStatus.DRAFT,
      expiresAt: new Date(Date.now() + 86_400_000),
      seller: { status: UserStatus.ACTIVE },
    });

    await expect(service.createThread('listing-1', 'buyer-1')).rejects.toThrow(BadRequestException);
    expect(prismaMock.thread.create).not.toHaveBeenCalled();
  });

  it('rejects an expired listing', async () => {
    prismaMock.listing.findUnique.mockResolvedValue({
      id: 'listing-1',
      sellerId: 'seller-1',
      status: ListingStatus.ACTIVE,
      expiresAt: new Date(Date.now() - 1_000),
      seller: { status: UserStatus.ACTIVE },
    });

    await expect(service.createThread('listing-1', 'buyer-1')).rejects.toThrow(BadRequestException);
    expect(prismaMock.thread.create).not.toHaveBeenCalled();
  });

  it('rejects an inactive seller', async () => {
    prismaMock.listing.findUnique.mockResolvedValue({
      id: 'listing-1',
      sellerId: 'seller-1',
      status: ListingStatus.ACTIVE,
      expiresAt: new Date(Date.now() + 86_400_000),
      seller: { status: UserStatus.SUSPENDED },
    });

    await expect(service.createThread('listing-1', 'buyer-1')).rejects.toThrow(BadRequestException);
    expect(prismaMock.thread.create).not.toHaveBeenCalled();
  });

  it('rejects the seller opening a conversation about their own listing', async () => {
    mockActiveListing('buyer-1');

    await expect(service.createThread('listing-1', 'buyer-1')).rejects.toThrow(BadRequestException);
    expect(prismaMock.thread.create).not.toHaveBeenCalled();
  });

  it('rejects a suspended or deleted buyer', async () => {
    mockActiveListing();
    prismaMock.user.findUnique.mockResolvedValue({ id: 'buyer-1', status: UserStatus.SUSPENDED });

    await expect(service.createThread('listing-1', 'buyer-1')).rejects.toThrow(BadRequestException);
    expect(prismaMock.thread.create).not.toHaveBeenCalled();
  });
});