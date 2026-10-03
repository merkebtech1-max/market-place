import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { RatingService } from './rating.service.js';
import { ReservationStatus, UserStatus } from '../../generated/prisma/enums.js';

describe('RatingService', () => {
  let service: RatingService;

  const txMock = {
    $queryRaw: vi.fn(),
    rating: {
      findUnique: vi.fn(),
      create: vi.fn(),
      aggregate: vi.fn(),
    },
    user: {
      update: vi.fn(),
    },
  };

  const prismaMock = {
    user: { findUnique: vi.fn() },
    reservation: { findUnique: vi.fn() },
    rating: { findUnique: vi.fn() },
    $transaction: vi.fn((callback: (tx: typeof txMock) => Promise<unknown>) => callback(txMock)),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new RatingService(prismaMock as any);
  });

  const dto = { reservationId: 'reservation-1', stars: 5, comment: 'Great seller!' };

  function mockUser(overrides: Record<string, unknown> = {}) {
    return { id: 'buyer-1', status: UserStatus.ACTIVE, ...overrides };
  }

  function mockReservation(overrides: Record<string, unknown> = {}) {
    return {
      id: 'reservation-1',
      listingId: 'listing-1',
      buyerId: 'buyer-1',
      sellerId: 'seller-1',
      status: ReservationStatus.COMPLETED,
      ...overrides,
    };
  }

  function mockRating() {
    return {
      id: 'rating-1',
      listingId: 'listing-1',
      raterId: 'buyer-1',
      rateeId: 'seller-1',
      stars: 5,
      comment: 'Great seller!',
      createdAt: new Date('2026-10-03T00:00:00.000Z'),
    };
  }

  it('throws NotFoundException when rater does not exist', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.reservation.findUnique.mockResolvedValue(mockReservation());
    await expect(service.createRating('ghost', dto)).rejects.toThrow(NotFoundException);
  });

  it('throws BadRequestException when rater is not ACTIVE', async () => {
    prismaMock.user.findUnique.mockResolvedValue(mockUser({ status: UserStatus.SUSPENDED }));
    prismaMock.reservation.findUnique.mockResolvedValue(mockReservation());
    await expect(service.createRating('buyer-1', dto)).rejects.toThrow(BadRequestException);
  });

  it('throws NotFoundException when reservation does not exist', async () => {
    prismaMock.user.findUnique.mockResolvedValue(mockUser());
    prismaMock.reservation.findUnique.mockResolvedValue(null);
    await expect(service.createRating('buyer-1', dto)).rejects.toThrow(NotFoundException);
  });

  it('throws ForbiddenException when rater is not the reservation buyer', async () => {
    prismaMock.user.findUnique.mockResolvedValue(mockUser());
    prismaMock.reservation.findUnique.mockResolvedValue(mockReservation({ buyerId: 'someone-else' }));
    await expect(service.createRating('buyer-1', dto)).rejects.toThrow(ForbiddenException);
  });

  it.each([ReservationStatus.RESERVED, ReservationStatus.CANCELLED, ReservationStatus.DISPUTED, ReservationStatus.REFUNDED])(
    'throws ConflictException when reservation is %s',
    async (status) => {
      prismaMock.user.findUnique.mockResolvedValue(mockUser());
      prismaMock.reservation.findUnique.mockResolvedValue(mockReservation({ status }));
      await expect(service.createRating('buyer-1', dto)).rejects.toThrow(ConflictException);
    },
  );

  it('throws ConflictException when rating already exists', async () => {
    prismaMock.user.findUnique.mockResolvedValue(mockUser());
    prismaMock.reservation.findUnique.mockResolvedValue(mockReservation());
    prismaMock.rating.findUnique.mockResolvedValue(mockRating());
    await expect(service.createRating('buyer-1', dto)).rejects.toThrow(ConflictException);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('creates the rating and seller aggregate in one transaction', async () => {
    prismaMock.user.findUnique.mockResolvedValue(mockUser());
    prismaMock.reservation.findUnique.mockResolvedValue(mockReservation());
    prismaMock.rating.findUnique.mockResolvedValue(null);
    txMock.rating.findUnique.mockResolvedValue(null);
    txMock.rating.create.mockResolvedValue(mockRating());
    txMock.rating.aggregate.mockResolvedValue({ _count: { _all: 3 }, _avg: { stars: 4.67 } });
    txMock.user.update.mockResolvedValue({});

    const result = await service.createRating('buyer-1', dto);

    expect(result.id).toBe('rating-1');
    expect(result.rateeId).toBe('seller-1');
    expect(txMock.rating.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        listingId: 'listing-1',
        raterId: 'buyer-1',
        rateeId: 'seller-1',
        stars: 5,
        comment: 'Great seller!',
      }),
    });
    expect(txMock.user.update).toHaveBeenCalledWith({
      where: { id: 'seller-1' },
      data: { ratingCount: 3, ratingAvg: 4.67 },
    });
  });
});
