import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ReservationQrService } from './reservation-qr.service.js';
import { generateQrToken, hashQrToken } from '../utils/qr-token.util.js';
import { ReservationStatus } from '../../generated/prisma/enums.js';

const TEST_SECRET = 'test-qr-secret';

describe('ReservationQrService', () => {
  let service: ReservationQrService;

  const prismaMock = {
    reservation: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
  };

  const configMock = { get: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    configMock.get.mockReturnValue(TEST_SECRET);
    service = new ReservationQrService(prismaMock as any, configMock as any);
  });

  function mockReservation(overrides: Record<string, unknown> = {}) {
    return {
      id: 'reservation-1',
      buyerId: 'buyer-1',
      status: ReservationStatus.RESERVED,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      qrTokenHash: null,
      ...overrides,
    };
  }

  it('throws NotFoundException when reservation does not exist', async () => {
    prismaMock.reservation.findUnique.mockResolvedValue(null);
    await expect(service.getBuyerQr('buyer-1', 'reservation-1')).rejects.toThrow(NotFoundException);
  });

  it('throws ForbiddenException when user is not the buyer', async () => {
    prismaMock.reservation.findUnique.mockResolvedValue(mockReservation());
    await expect(service.getBuyerQr('someone-else', 'reservation-1')).rejects.toThrow(ForbiddenException);
  });

  it('throws ConflictException for a non-RESERVED reservation', async () => {
    prismaMock.reservation.findUnique.mockResolvedValue(mockReservation({ status: ReservationStatus.CANCELLED }));
    await expect(service.getBuyerQr('buyer-1', 'reservation-1')).rejects.toThrow(ConflictException);
  });

  it('throws ConflictException when the reservation has expired', async () => {
    prismaMock.reservation.findUnique.mockResolvedValue(
      mockReservation({ expiresAt: new Date(Date.now() - 1000) }),
    );
    await expect(service.getBuyerQr('buyer-1', 'reservation-1')).rejects.toThrow(ConflictException);
  });

  it('persists the hash on first request and returns the raw token', async () => {
    const reservation = mockReservation();
    prismaMock.reservation.findUnique.mockResolvedValue(reservation);
    prismaMock.reservation.updateMany.mockResolvedValue({ count: 1 });

    const result = await service.getBuyerQr('buyer-1', 'reservation-1');

    const expectedToken = generateQrToken(reservation.id, TEST_SECRET);
    expect(result.token).toBe(expectedToken);
    expect(result.reservationId).toBe(reservation.id);
    expect(result.expiresAt).toBe(reservation.expiresAt);
    expect((result as any).qrTokenHash).toBeUndefined();
    expect(prismaMock.reservation.updateMany).toHaveBeenCalledWith({
      where: { id: reservation.id, qrTokenHash: null },
      data: { qrTokenHash: hashQrToken(expectedToken) },
    });
  });

  it('does not overwrite an existing matching hash', async () => {
    const expectedToken = generateQrToken('reservation-1', TEST_SECRET);
    prismaMock.reservation.findUnique.mockResolvedValue(
      mockReservation({ qrTokenHash: hashQrToken(expectedToken) }),
    );

    const result = await service.getBuyerQr('buyer-1', 'reservation-1');

    expect(result.token).toBe(expectedToken);
    expect(prismaMock.reservation.updateMany).not.toHaveBeenCalled();
  });

  it('throws InternalServerErrorException when stored hash mismatches', async () => {
    prismaMock.reservation.findUnique.mockResolvedValue(
      mockReservation({ qrTokenHash: 'some-other-hash' }),
    );

    await expect(service.getBuyerQr('buyer-1', 'reservation-1')).rejects.toThrow(
      'Reservation QR credential is inconsistent. Please contact support.',
    );
    expect(prismaMock.reservation.updateMany).not.toHaveBeenCalled();
  });

});
