import { AdminReportsService } from './admin-reports.service.js';
import { ReportStatus, ReportTargetType } from '../../generated/prisma/enums.js';

describe('AdminReportsService', () => {
  let service: AdminReportsService;

  const prismaMock = {
    report: { findMany: vi.fn(), groupBy: vi.fn() },
    listing: { findMany: vi.fn() },
    user: { findMany: vi.fn() },
    message: { findMany: vi.fn() },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.report.groupBy.mockResolvedValue([]);
    service = new AdminReportsService(prismaMock as any);
  });

  function mockReportRow(overrides: Record<string, unknown> = {}) {
    return {
      id: 'report-1',
      targetType: ReportTargetType.LISTING,
      targetId: 'listing-1',
      reason: 'SCAM',
      note: null,
      status: ReportStatus.PENDING,
      createdAt: new Date('2026-10-03T00:00:00.000Z'),
      reporter: { id: 'user-1', displayName: 'Buyer One', avatarKey: null, status: 'ACTIVE' },
      ...overrides,
    };
  }

  it('defaults to PENDING reports, newest first', async () => {
    prismaMock.report.findMany.mockResolvedValue([]);

    await service.listReports({});

    expect(prismaMock.report.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: ReportStatus.PENDING },
        orderBy: { createdAt: 'desc' },
      }),
    );
  });

  it('filters by explicit status and targetType', async () => {
    prismaMock.report.findMany.mockResolvedValue([]);

    await service.listReports({ status: 'RESOLVED', targetType: 'MESSAGE' });

    expect(prismaMock.report.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: ReportStatus.RESOLVED, targetType: ReportTargetType.MESSAGE },
      }),
    );
  });

  it('includes listing context for LISTING reports', async () => {
    prismaMock.report.findMany.mockResolvedValue([mockReportRow()]);
    prismaMock.listing.findMany.mockResolvedValue([{
      id: 'listing-1',
      title: 'Nice camera',
      status: 'ACTIVE',
      priceCents: 50000,
      condition: 'GOOD',
      createdAt: new Date('2026-09-01'),
      seller: { id: 'seller-1', displayName: 'Seller One' },
    }]);

    const result = await service.listReports({});

    expect(result[0].target).toMatchObject({ listing: { id: 'listing-1', title: 'Nice camera' } });
  });

  it('includes user context for USER reports', async () => {
    prismaMock.report.findMany.mockResolvedValue([mockReportRow({ targetType: ReportTargetType.USER, targetId: 'user-9' })]);
    prismaMock.user.findMany.mockResolvedValue([{ id: 'user-9', displayName: 'Bad Actor', status: 'ACTIVE' }]);

    const result = await service.listReports({});

    expect(result[0].target).toMatchObject({ user: { id: 'user-9', displayName: 'Bad Actor' } });
  });

  it('includes message content and thread context for MESSAGE reports', async () => {
    prismaMock.report.findMany.mockResolvedValue([mockReportRow({ targetType: ReportTargetType.MESSAGE, targetId: 'message-1' })]);
    prismaMock.message.findMany.mockResolvedValue([{
      id: 'message-1',
      body: 'call me 0911...',
      sender: { id: 'sender-1', displayName: 'Sender' },
      thread: { id: 'thread-1', listingId: 'listing-1' },
    }]);

    const result = await service.listReports({});

    expect(result[0].target).toMatchObject({
      message: { id: 'message-1', body: 'call me 0911...' },
      thread: { id: 'thread-1', listingId: 'listing-1' },
    });
  });
});
