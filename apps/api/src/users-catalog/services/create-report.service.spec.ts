import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreateReportService } from './create-report.service.js';
import { ReportStatus, UserStatus } from '../../generated/prisma/enums.js';

describe('CreateReportService', () => {
  let service: CreateReportService;

  const prismaMock = {
    user: { findUnique: vi.fn() },
    listing: { findUnique: vi.fn() },
    message: { findUnique: vi.fn() },
    report: { findFirst: vi.fn(), create: vi.fn() },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new CreateReportService(prismaMock as any);
  });

  function mockReporter(overrides: Record<string, unknown> = {}) {
    return { id: 'user-1', status: UserStatus.ACTIVE, ...overrides };
  }

  function mockReport() {
    return {
      id: 'report-1',
      reporterId: 'user-1',
      targetType: 'LISTING',
      targetId: 'listing-1',
      listingId: 'listing-1',
      reason: 'SCAM',
      note: null,
      status: ReportStatus.PENDING,
      createdAt: new Date('2026-10-03T00:00:00.000Z'),
    };
  }

  it('throws NotFoundException when reporter does not exist', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    await expect(
      service.createReport('ghost', { targetType: 'LISTING', targetId: 'listing-1', reason: 'SCAM' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws BadRequestException when reporter is not ACTIVE', async () => {
    prismaMock.user.findUnique.mockResolvedValue(mockReporter({ status: UserStatus.SUSPENDED }));
    await expect(
      service.createReport('user-1', { targetType: 'LISTING', targetId: 'listing-1', reason: 'SCAM' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws NotFoundException when the listing target does not exist', async () => {
    prismaMock.user.findUnique.mockResolvedValue(mockReporter());
    prismaMock.listing.findUnique.mockResolvedValue(null);
    await expect(
      service.createReport('user-1', { targetType: 'LISTING', targetId: 'missing', reason: 'SCAM' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('derives listingId server-side for listing reports', async () => {
    prismaMock.user.findUnique.mockResolvedValue(mockReporter());
    prismaMock.listing.findUnique.mockResolvedValue({ id: 'listing-1', sellerId: 'seller-1' });
    prismaMock.report.findFirst.mockResolvedValue(null);
    prismaMock.report.create.mockResolvedValue(mockReport());

    const result = await service.createReport('user-1', {
      targetType: 'LISTING',
      targetId: 'listing-1',
      reason: 'SCAM',
    });

    expect(result.status).toBe(ReportStatus.PENDING);
    expect(prismaMock.report.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        reporterId: 'user-1',
        targetType: 'LISTING',
        targetId: 'listing-1',
        listingId: 'listing-1',
        status: ReportStatus.PENDING,
      }),
    });
  });

  it('throws BadRequestException when reporting yourself', async () => {
    prismaMock.user.findUnique.mockResolvedValue(mockReporter());
    await expect(
      service.createReport('user-1', { targetType: 'USER', targetId: 'user-1', reason: 'SPAM' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws NotFoundException when the user target does not exist', async () => {
    prismaMock.user.findUnique
      .mockResolvedValueOnce(mockReporter())
      .mockResolvedValueOnce(null);
    await expect(
      service.createReport('user-1', { targetType: 'USER', targetId: 'ghost', reason: 'SPAM' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws NotFoundException when the message does not exist', async () => {
    prismaMock.user.findUnique.mockResolvedValue(mockReporter());
    prismaMock.message.findUnique.mockResolvedValue(null);
    await expect(
      service.createReport('user-1', { targetType: 'MESSAGE', targetId: 'missing', reason: 'ABUSE' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws ForbiddenException when the reporter is not in the message thread', async () => {
    prismaMock.user.findUnique.mockResolvedValue(mockReporter());
    prismaMock.message.findUnique.mockResolvedValue({
      id: 'message-1',
      senderId: 'seller-9',
      thread: { buyerId: 'buyer-9', sellerId: 'seller-9' },
    });
    await expect(
      service.createReport('user-1', { targetType: 'MESSAGE', targetId: 'message-1', reason: 'ABUSE' }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('allows a message report when the reporter is the thread buyer', async () => {
    prismaMock.user.findUnique.mockResolvedValue(mockReporter());
    prismaMock.message.findUnique.mockResolvedValue({
      id: 'message-1',
      senderId: 'seller-9',
      thread: { buyerId: 'user-1', sellerId: 'seller-9' },
    });
    prismaMock.report.findFirst.mockResolvedValue(null);
    prismaMock.report.create.mockResolvedValue({ ...mockReport(), targetType: 'MESSAGE', targetId: 'message-1' });

    await expect(
      service.createReport('user-1', { targetType: 'MESSAGE', targetId: 'message-1', reason: 'ABUSE' }),
    ).resolves.toMatchObject({ targetId: 'message-1', status: ReportStatus.PENDING });
  });

  it('creates a USER report with listingId = null', async () => {
    prismaMock.user.findUnique
      .mockResolvedValueOnce(mockReporter())
      .mockResolvedValueOnce({ id: 'seller-2' });
    prismaMock.report.findFirst.mockResolvedValue(null);
    prismaMock.report.create.mockResolvedValue({
      ...mockReport(),
      targetType: 'USER',
      targetId: 'seller-2',
      listingId: null,
    });

    const result = await service.createReport('user-1', {
      targetType: 'USER',
      targetId: 'seller-2',
      reason: 'SPAM',
    });

    expect(result.targetType).toBe('USER');
    expect(prismaMock.report.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ listingId: null }),
    });
  });

  it('stores server-owned fields from the service argument and DTO, never from the client', async () => {
    prismaMock.user.findUnique.mockResolvedValue(mockReporter());
    prismaMock.listing.findUnique.mockResolvedValue({ id: 'listing-1', sellerId: 'seller-1' });
    prismaMock.report.findFirst.mockResolvedValue(null);
    prismaMock.report.create.mockResolvedValue(mockReport());

    await service.createReport('user-1', {
      targetType: 'LISTING',
      targetId: 'listing-1',
      reason: 'SCAM',
      note: 'Looks like a duplicate posting',
    });

    expect(prismaMock.report.create).toHaveBeenCalledWith({
      data: {
        reporterId: 'user-1',
        targetType: 'LISTING',
        targetId: 'listing-1',
        listingId: 'listing-1',
        reason: 'SCAM',
        note: 'Looks like a duplicate posting',
        status: ReportStatus.PENDING,
      },
    });
  });

  it('throws BadRequestException when reporting your own listing', async () => {
    prismaMock.user.findUnique.mockResolvedValue(mockReporter());
    prismaMock.listing.findUnique.mockResolvedValue({ id: 'listing-1', sellerId: 'user-1' });

    await expect(
      service.createReport('user-1', { targetType: 'LISTING', targetId: 'listing-1', reason: 'SCAM' }),
    ).rejects.toThrow(BadRequestException);
    expect(prismaMock.report.create).not.toHaveBeenCalled();
  });

  it('throws BadRequestException when reporting your own message', async () => {
    prismaMock.user.findUnique.mockResolvedValue(mockReporter());
    prismaMock.message.findUnique.mockResolvedValue({
      id: 'message-1',
      senderId: 'user-1',
      thread: { buyerId: 'user-1', sellerId: 'seller-9' },
    });

    await expect(
      service.createReport('user-1', { targetType: 'MESSAGE', targetId: 'message-1', reason: 'ABUSE' }),
    ).rejects.toThrow(BadRequestException);
    expect(prismaMock.report.create).not.toHaveBeenCalled();
  });

  it('maps unexpected Prisma failures to a generic InternalServerErrorException', async () => {
    prismaMock.user.findUnique.mockRejectedValue(new Error('connection refused'));

    await expect(
      service.createReport('user-1', { targetType: 'LISTING', targetId: 'listing-1', reason: 'SCAM' }),
    ).rejects.toThrow(InternalServerErrorException);
  });

  it('throws ConflictException on a duplicate pending report for the same target', async () => {
    prismaMock.user.findUnique.mockResolvedValue(mockReporter());
    prismaMock.listing.findUnique.mockResolvedValue({ id: 'listing-1', sellerId: 'seller-1' });
    prismaMock.report.findFirst.mockResolvedValue(mockReport());

    await expect(
      service.createReport('user-1', { targetType: 'LISTING', targetId: 'listing-1', reason: 'SCAM' }),
    ).rejects.toThrow(ConflictException);
    expect(prismaMock.report.create).not.toHaveBeenCalled();
  });
});
