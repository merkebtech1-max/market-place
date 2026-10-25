import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ReservationLifecycleService } from './reservation-lifecycle.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CompletionMethod, ListingStatus, ReservationStatus } from '../../generated/prisma/enums.js';
import { generateQrToken, hashQrToken } from '../utils/qr-token.util.js';

describe('ReservationLifecycleService', () => {
  let service: ReservationLifecycleService;

  const prismaMock = {
    reservation: {
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      updateMany: vi.fn(),
    },
    listing: {
      updateMany: vi.fn(),
    },
    $transaction: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReservationLifecycleService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<ReservationLifecycleService>(ReservationLifecycleService);

    // $transaction runs the callback against a tx alias of the mocked client.
    prismaMock.$transaction.mockImplementation(async (callback: (tx: any) => Promise<unknown>) => callback(prismaMock));
  });

  function mockReservationRow(overrides: Partial<{
    id: string;
    listingId: string;
    buyerId: string;
    sellerId: string;
    status: ReservationStatus;
    expiresAt: Date;
    createdAt: Date;
  }> = {}) {
    return {
      id: 'reservation-1',
      listingId: 'listing-1',
      buyerId: 'buyer-1',
      sellerId: 'seller-1',
      status: ReservationStatus.RESERVED,
      expiresAt: new Date('2030-10-01T00:00:00.000Z'),
      createdAt: new Date('2026-09-29T00:00:00.000Z'),
      ...overrides,
    };
  }

  function mockCancelledReservation() {
    return mockReservationRow({ status: ReservationStatus.CANCELLED });
  }

  describe('cancelReservation', () => {
    it('throws NotFoundException when the reservation does not exist', async () => {
      prismaMock.reservation.findUnique.mockResolvedValue(null);

      await expect(service.cancelReservation('buyer-1', 'missing')).rejects.toThrow(NotFoundException);
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when a non-owner tries to cancel', async () => {
      prismaMock.reservation.findUnique.mockResolvedValue(
        mockReservationRow({ buyerId: 'buyer-2' }),
      );

      await expect(service.cancelReservation('buyer-1', 'reservation-1')).rejects.toThrow(BadRequestException);
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('throws ConflictException when the reservation is already cancelled', async () => {
      prismaMock.reservation.findUnique.mockResolvedValue(
        mockReservationRow({ status: ReservationStatus.CANCELLED }),
      );

      await expect(service.cancelReservation('buyer-1', 'reservation-1')).rejects.toThrow(ConflictException);
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('throws ConflictException when the reservation is completed', async () => {
      prismaMock.reservation.findUnique.mockResolvedValue(
        mockReservationRow({ status: ReservationStatus.COMPLETED }),
      );

      await expect(service.cancelReservation('buyer-1', 'reservation-1')).rejects.toThrow(ConflictException);
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('throws ConflictException when the reservation is disputed', async () => {
      prismaMock.reservation.findUnique.mockResolvedValue(
        mockReservationRow({ status: ReservationStatus.DISPUTED }),
      );

      await expect(service.cancelReservation('buyer-1', 'reservation-1')).rejects.toThrow(ConflictException);
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('throws ConflictException when the reservation has expired', async () => {
      prismaMock.reservation.findUnique.mockResolvedValue(
        mockReservationRow({ expiresAt: new Date('2020-01-01T00:00:00.000Z') }),
      );

      await expect(service.cancelReservation('buyer-1', 'reservation-1')).rejects.toThrow(ConflictException);
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('successfully cancels a reserved reservation and reopens the listing', async () => {
      // First call: validation phase returns RESERVED reservation
      // Second call: post-transaction read returns CANCELLED reservation
      prismaMock.reservation.findUnique
        .mockResolvedValueOnce(mockReservationRow())
        .mockResolvedValueOnce(mockCancelledReservation());
      prismaMock.reservation.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.listing.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.cancelReservation('buyer-1', 'reservation-1');

      expect(result).toMatchObject({
        id: 'reservation-1',
        listingId: 'listing-1',
        buyerId: 'buyer-1',
        sellerId: 'seller-1',
        status: ReservationStatus.CANCELLED,
      });

      // Verify reservation CAS update
      expect(prismaMock.reservation.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'reservation-1',
          status: ReservationStatus.RESERVED,
        },
        data: { status: ReservationStatus.CANCELLED },
      });

      // Verify listing CAS update
      expect(prismaMock.listing.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'listing-1',
          status: ListingStatus.RESERVED,
        },
        data: { status: ListingStatus.ACTIVE },
      });
    });

    it('throws ConflictException and rolls back when the listing is no longer RESERVED', async () => {
      prismaMock.reservation.findUnique.mockResolvedValue(mockReservationRow());
      prismaMock.reservation.updateMany.mockResolvedValue({ count: 1 });
      // Listing CAS matches 0 rows — listing was already changed by another operation
      prismaMock.listing.updateMany.mockResolvedValue({ count: 0 });

      // The entire transaction rolls back — reservation stays RESERVED
      await expect(service.cancelReservation('buyer-1', 'reservation-1')).rejects.toThrow(ConflictException);

      // Both updates were attempted
      expect(prismaMock.reservation.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'reservation-1',
          status: ReservationStatus.RESERVED,
        },
        data: { status: ReservationStatus.CANCELLED },
      });
      expect(prismaMock.listing.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'listing-1',
          status: ListingStatus.RESERVED,
        },
        data: { status: ListingStatus.ACTIVE },
      });
    });

    it('throws ConflictException when the reservation CAS fails (concurrent modification)', async () => {
      prismaMock.reservation.findUnique.mockResolvedValue(mockReservationRow());
      // Reservation CAS matches 0 rows — concurrent operation changed it
      prismaMock.reservation.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.cancelReservation('buyer-1', 'reservation-1')).rejects.toThrow(ConflictException);

      // Listing update should never be attempted
      expect(prismaMock.listing.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('completeReservationByQr', () => {
    const token = generateQrToken('reservation-1', 'test-secret');

    function mockScannableReservation(overrides: Record<string, unknown> = {}) {
      return {
        id: 'reservation-1',
        listingId: 'listing-1',
        sellerId: 'seller-1',
        status: ReservationStatus.RESERVED,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        qrConsumedAt: null,
        ...overrides,
      };
    }

    it('throws NotFoundException when no reservation matches the token', async () => {
      prismaMock.reservation.findUnique.mockResolvedValue(null);
      await expect(service.completeReservationByQr('seller-1', token)).rejects.toThrow(NotFoundException);
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException for a different seller', async () => {
      prismaMock.reservation.findUnique.mockResolvedValue(mockScannableReservation());
      await expect(service.completeReservationByQr('other-seller', token)).rejects.toThrow(ForbiddenException);
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('throws ConflictException when not RESERVED', async () => {
      prismaMock.reservation.findUnique.mockResolvedValue(
        mockScannableReservation({ status: ReservationStatus.COMPLETED }),
      );
      await expect(service.completeReservationByQr('seller-1', token)).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException when expired', async () => {
      prismaMock.reservation.findUnique.mockResolvedValue(
        mockScannableReservation({ expiresAt: new Date(Date.now() - 1000) }),
      );
      await expect(service.completeReservationByQr('seller-1', token)).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException when QR already consumed', async () => {
      prismaMock.reservation.findUnique.mockResolvedValue(
        mockScannableReservation({ qrConsumedAt: new Date() }),
      );
      await expect(service.completeReservationByQr('seller-1', token)).rejects.toThrow(ConflictException);
    });

    it('completes the reservation and marks the listing SOLD', async () => {
      prismaMock.reservation.findUnique.mockResolvedValue(mockScannableReservation());
      prismaMock.reservation.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.listing.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.reservation.findUniqueOrThrow.mockResolvedValue({
        id: 'reservation-1',
        listingId: 'listing-1',
        status: ReservationStatus.COMPLETED,
        completedAt: new Date('2026-10-03T00:00:00.000Z'),
        completionMethod: CompletionMethod.QR_SCAN,
      });

      const result = await service.completeReservationByQr('seller-1', token);

      expect(result.status).toBe(ReservationStatus.COMPLETED);
      expect(result.completionMethod).toBe(CompletionMethod.QR_SCAN);
      expect(result.reservationId).toBe('reservation-1');

      expect(prismaMock.reservation.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { qrTokenHash: hashQrToken(token) } }),
      );
      expect(prismaMock.reservation.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'reservation-1',
          sellerId: 'seller-1',
          status: ReservationStatus.RESERVED,
          qrConsumedAt: null,
        },
        data: expect.objectContaining({
          status: ReservationStatus.COMPLETED,
          completionMethod: CompletionMethod.QR_SCAN,
        }),
      });
      expect(prismaMock.listing.updateMany).toHaveBeenCalledWith({
        where: { id: 'listing-1', status: ListingStatus.RESERVED },
        data: { status: ListingStatus.SOLD },
      });

      // completedAt and qrConsumedAt share one timestamp
      const data = prismaMock.reservation.updateMany.mock.calls[0][0].data;
      expect(data.completedAt).toBe(data.qrConsumedAt);
    });

    it('throws ConflictException when reservation CAS fails (double completion)', async () => {
      prismaMock.reservation.findUnique.mockResolvedValue(mockScannableReservation());
      prismaMock.reservation.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.completeReservationByQr('seller-1', token)).rejects.toThrow(ConflictException);
      expect(prismaMock.listing.updateMany).not.toHaveBeenCalled();
    });

    it('throws ConflictException when listing CAS fails (rolls back reservation)', async () => {
      prismaMock.reservation.findUnique.mockResolvedValue(mockScannableReservation());
      prismaMock.reservation.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.listing.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.completeReservationByQr('seller-1', token)).rejects.toThrow(ConflictException);
    });
  });
});
