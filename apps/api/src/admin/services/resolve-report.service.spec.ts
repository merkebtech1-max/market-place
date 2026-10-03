import { ConflictException, NotFoundException } from '@nestjs/common';
import { ResolveReportService } from './resolve-report.service.js';
import { ReportStatus } from '../../generated/prisma/enums.js';

describe('ResolveReportService', () => {
  let service: ResolveReportService;

  const prismaMock = {
    report: { findUnique: vi.fn(), updateMany: vi.fn() },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ResolveReportService(prismaMock as any);
  });

  const dto = { status: 'RESOLVED' as const, resolution: 'Listing removed for policy violation.' };

  it('throws NotFoundException when the report does not exist', async () => {
    prismaMock.report.findUnique.mockResolvedValue(null);
    await expect(service.resolveReport('mod-1', 'missing', dto)).rejects.toThrow(NotFoundException);
    expect(prismaMock.report.updateMany).not.toHaveBeenCalled();
  });

  it('throws ConflictException when the report is already resolved', async () => {
    prismaMock.report.findUnique.mockResolvedValue({ id: 'report-1', status: ReportStatus.RESOLVED, createdAt: new Date() });
    await expect(service.resolveReport('mod-1', 'report-1', dto)).rejects.toThrow(ConflictException);
    expect(prismaMock.report.updateMany).not.toHaveBeenCalled();
  });

  it('resolves a PENDING report with server-owned fields', async () => {
    const createdAt = new Date('2026-10-03T00:00:00.000Z');
    prismaMock.report.findUnique.mockResolvedValue({ id: 'report-1', status: ReportStatus.PENDING, createdAt });
    prismaMock.report.updateMany.mockResolvedValue({ count: 1 });

    const result = await service.resolveReport('mod-1', 'report-1', dto);

    expect(prismaMock.report.updateMany).toHaveBeenCalledWith({
      where: { id: 'report-1', status: ReportStatus.PENDING },
      data: { status: 'RESOLVED', resolution: dto.resolution, resolvedById: 'mod-1' },
    });
    expect(result).toEqual({
      id: 'report-1',
      status: 'RESOLVED',
      resolution: dto.resolution,
      resolvedById: 'mod-1',
      createdAt,
    });
  });

  it('returns ConflictException when the conditional update loses a race', async () => {
    const createdAt = new Date('2026-10-03T00:00:00.000Z');
    prismaMock.report.findUnique.mockResolvedValue({ id: 'report-1', status: ReportStatus.PENDING, createdAt });
    prismaMock.report.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.resolveReport('mod-1', 'report-1', dto)).rejects.toThrow(ConflictException);
  });
});
