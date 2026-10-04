import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ResolveReportService } from './resolve-report.service.js';
import { ReportStatus } from '../../generated/prisma/enums.js';

describe('ResolveReportService', () => {
  let service: ResolveReportService;

  const txMock = {
    report: { findUnique: vi.fn(), updateMany: vi.fn() },
    listing: { findUnique: vi.fn(), update: vi.fn() },
    user: { findUnique: vi.fn(), update: vi.fn() },
    message: { findUnique: vi.fn(), delete: vi.fn() },
    auditLog: { create: vi.fn() },
  };

  const prismaMock = {
    $transaction: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation(async (callback: (tx: any) => Promise<unknown>) => callback(txMock));
    service = new ResolveReportService(prismaMock as any);
  });

  const baseReport = {
    id: 'report-1',
    status: ReportStatus.PENDING,
    createdAt: new Date('2026-10-03T00:00:00.000Z'),
    targetType: 'LISTING',
    targetId: 'listing-1',
  };

  function mockReport(overrides: Record<string, unknown> = {}) {
    txMock.report.findUnique.mockResolvedValue({ ...baseReport, ...overrides });
  }

  it('throws NotFoundException when the report does not exist', async () => {
    txMock.report.findUnique.mockResolvedValue(null);
    await expect(service.resolveReport('mod-1', 'missing', { action: 'DISMISS', resolution: 'nope' })).rejects.toThrow(NotFoundException);
    expect(txMock.report.updateMany).not.toHaveBeenCalled();
  });

  it('throws ConflictException when the report is already handled', async () => {
    mockReport({ status: ReportStatus.RESOLVED });
    await expect(service.resolveReport('mod-1', 'report-1', { action: 'DISMISS', resolution: 'nope' })).rejects.toThrow(ConflictException);
    expect(txMock.report.updateMany).not.toHaveBeenCalled();
  });

  it('rejects actions that do not match the report target type', async () => {
    mockReport({ targetType: 'USER', targetId: 'user-9' });
    txMock.report.updateMany.mockResolvedValue({ count: 1 });
    await expect(
      service.resolveReport('mod-1', 'report-1', { action: 'REMOVE_LISTING', resolution: 'bad' }),
    ).rejects.toThrow(BadRequestException);
    expect(txMock.listing.update).not.toHaveBeenCalled();
    expect(txMock.auditLog.create).not.toHaveBeenCalled();
  });

  it('dismissals set the report to DISMISSED and audit only', async () => {
    mockReport();
    txMock.report.updateMany.mockResolvedValue({ count: 1 });

    const result = await service.resolveReport('mod-1', 'report-1', { action: 'DISMISS', resolution: 'No violation.' });

    expect(txMock.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ actorId: 'mod-1', action: 'REPORT_DISMISSED', target: 'report-1' }),
    });
    expect(txMock.report.updateMany).toHaveBeenCalledWith({
      where: { id: 'report-1', status: ReportStatus.REVIEWING },
      data: { status: 'DISMISSED', resolution: 'No violation.', resolvedById: 'mod-1' },
    });
    expect(result).toMatchObject({ id: 'report-1', status: 'DISMISSED', action: 'DISMISS', resolvedById: 'mod-1' });
  });

  it('REMOVE_LISTING removes the listing, audits, and resolves', async () => {
    mockReport();
    txMock.listing.findUnique.mockResolvedValue({ id: 'listing-1', status: 'ACTIVE' });
    txMock.report.updateMany.mockResolvedValue({ count: 1 });

    const result = await service.resolveReport('mod-1', 'report-1', { action: 'REMOVE_LISTING', resolution: 'Policy violation.' });

    expect(txMock.listing.update).toHaveBeenCalledWith({ where: { id: 'listing-1' }, data: { status: 'REMOVED' } });
    expect(txMock.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: 'LISTING_REMOVED', target: 'listing-1' }),
    });
    expect(result).toMatchObject({ status: 'RESOLVED', action: 'REMOVE_LISTING' });
  });

  it('REMOVE_LISTING conflicts when the listing is already removed', async () => {
    mockReport();
    txMock.listing.findUnique.mockResolvedValue({ id: 'listing-1', status: 'REMOVED' });

    await expect(
      service.resolveReport('mod-1', 'report-1', { action: 'REMOVE_LISTING', resolution: 'x' }),
    ).rejects.toThrow(ConflictException);
    expect(txMock.listing.update).not.toHaveBeenCalled();
  });

  it('SUSPEND_USER suspends the user, audits, and resolves', async () => {
    mockReport({ targetType: 'USER', targetId: 'user-9' });
    txMock.user.findUnique.mockResolvedValue({ id: 'user-9', status: 'ACTIVE', role: 'USER' });
    txMock.report.updateMany.mockResolvedValue({ count: 1 });

    const result = await service.resolveReport('mod-1', 'report-1', { action: 'SUSPEND_USER', resolution: 'Abuse.' });

    expect(txMock.user.update).toHaveBeenCalledWith({ where: { id: 'user-9' }, data: { status: 'SUSPENDED' } });
    expect(txMock.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: 'USER_SUSPENDED', target: 'user-9' }),
    });
    expect(result).toMatchObject({ status: 'RESOLVED', action: 'SUSPEND_USER' });
  });

  it('DELETE_USER soft-deletes without touching related records', async () => {
    mockReport({ targetType: 'USER', targetId: 'user-9' });
    txMock.user.findUnique.mockResolvedValue({ id: 'user-9', status: 'ACTIVE', role: 'USER' });
    txMock.report.updateMany.mockResolvedValue({ count: 1 });

    const result = await service.resolveReport('mod-1', 'report-1', { action: 'DELETE_USER', resolution: 'Scam.' });

    expect(txMock.user.update).toHaveBeenCalledWith({ where: { id: 'user-9' }, data: { status: 'DELETED' } });
    expect(txMock.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: 'USER_DELETED', target: 'user-9' }),
    });
    expect(result).toMatchObject({ status: 'RESOLVED', action: 'DELETE_USER' });
  });

  it('cannot suspend an ADMIN/MODERATOR through the report flow', async () => {
    mockReport({ targetType: 'USER', targetId: 'user-1' });
    txMock.user.findUnique.mockResolvedValue({ id: 'user-1', status: 'ACTIVE', role: 'ADMIN' });
    txMock.report.updateMany.mockResolvedValue({ count: 1 });

    await expect(
      service.resolveReport('mod-1', 'report-1', { action: 'SUSPEND_USER', resolution: 'x' }),
    ).rejects.toThrow(BadRequestException);
    expect(txMock.user.update).not.toHaveBeenCalled();
  });

  it('cannot delete an ADMIN/MODERATOR through the report flow', async () => {
    mockReport({ targetType: 'USER', targetId: 'user-1' });
    txMock.user.findUnique.mockResolvedValue({ id: 'user-1', status: 'ACTIVE', role: 'MODERATOR' });
    txMock.report.updateMany.mockResolvedValue({ count: 1 });

    await expect(
      service.resolveReport('mod-1', 'report-1', { action: 'DELETE_USER', resolution: 'x' }),
    ).rejects.toThrow(BadRequestException);
    expect(txMock.user.update).not.toHaveBeenCalled();
  });

  it('REMOVE_MESSAGE deletes the message and audits metadata only', async () => {
    mockReport({ targetType: 'MESSAGE', targetId: 'msg-1' });
    txMock.message.findUnique.mockResolvedValue({ id: 'msg-1', threadId: 'thread-1', senderId: 'user-9' });
    txMock.report.updateMany.mockResolvedValue({ count: 1 });

    const result = await service.resolveReport('mod-1', 'report-1', { action: 'REMOVE_MESSAGE', resolution: 'Contact leak.' });

    expect(txMock.message.delete).toHaveBeenCalledWith({ where: { id: 'msg-1' } });
    expect(txMock.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'MESSAGE_REMOVED',
        target: 'msg-1',
        diff: { reportId: 'report-1', threadId: 'thread-1', senderId: 'user-9' },
      }),
    });
    expect(result).toMatchObject({ status: 'RESOLVED', action: 'REMOVE_MESSAGE' });
  });

  it('claims the report (PENDING → REVIEWING) before acting, then resolves REVIEWING → final', async () => {
    mockReport();
    txMock.listing.findUnique.mockResolvedValue({ id: 'listing-1', status: 'ACTIVE' });
    txMock.report.updateMany.mockResolvedValue({ count: 1 });

    await service.resolveReport('mod-1', 'report-1', { action: 'REMOVE_LISTING', resolution: 'x' });

    expect(txMock.report.updateMany).toHaveBeenNthCalledWith(1, {
      where: { id: 'report-1', status: ReportStatus.PENDING },
      data: { status: ReportStatus.REVIEWING },
    });
    expect(txMock.report.updateMany).toHaveBeenNthCalledWith(2, {
      where: { id: 'report-1', status: ReportStatus.REVIEWING },
      data: { status: 'RESOLVED', resolution: 'x', resolvedById: 'mod-1' },
    });
  });

  it('fails after the claim when the target is missing, so no final update or audit happens', async () => {
    mockReport();
    txMock.listing.findUnique.mockResolvedValue(null);
    txMock.report.updateMany.mockResolvedValue({ count: 1 });

    await expect(
      service.resolveReport('mod-1', 'report-1', { action: 'REMOVE_LISTING', resolution: 'x' }),
    ).rejects.toThrow(NotFoundException);

    // The claim DID happen (PENDING → REVIEWING)...
    expect(txMock.report.updateMany).toHaveBeenCalledTimes(1);
    expect(txMock.report.updateMany).toHaveBeenCalledWith({
      where: { id: 'report-1', status: ReportStatus.PENDING },
      data: { status: ReportStatus.REVIEWING },
    });
    // ...but no moderation, no audit, and no final RESOLVED update —
    // in production the thrown error rolls the tx back, returning the
    // report to PENDING.
    expect(txMock.listing.update).not.toHaveBeenCalled();
    expect(txMock.auditLog.create).not.toHaveBeenCalled();
    expect(
      txMock.report.updateMany.mock.calls.some(
        (call) => call[0]?.data?.status === 'RESOLVED' || call[0]?.data?.status === 'DISMISSED',
      ),
    ).toBe(false);
  });

  it('returns ConflictException when the conditional update loses a race', async () => {
    mockReport();
    txMock.listing.findUnique.mockResolvedValue({ id: 'listing-1', status: 'ACTIVE' });
    txMock.report.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.resolveReport('mod-1', 'report-1', { action: 'REMOVE_LISTING', resolution: 'x' }),
    ).rejects.toThrow(ConflictException);
  });
});
