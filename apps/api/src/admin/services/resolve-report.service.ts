import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Prisma } from '../../generated/prisma/client.js';
import { ListingStatus, ReportStatus, ReportTargetType, UserRole, UserStatus } from '../../generated/prisma/enums.js';
import { ResolveReportDto, type ReportAction } from '../dto/resolve-report.dto.js';

/** View of a handled report, including the action taken. */
export interface ResolveReportResponse {
  id: string;
  status: ReportStatus;
  action: ReportAction;
  resolution: string;
  resolvedById: string;
  createdAt: Date;
}

/** Actions valid per report target type. DISMISS works against any target. */
const ACTION_ALLOWED_TARGETS: Record<ReportAction, ReportTargetType[]> = {
  REMOVE_LISTING: [ReportTargetType.LISTING],
  SUSPEND_USER: [ReportTargetType.USER],
  DELETE_USER: [ReportTargetType.USER],
  REMOVE_MESSAGE: [ReportTargetType.MESSAGE],
  DISMISS: [ReportTargetType.LISTING, ReportTargetType.USER, ReportTargetType.MESSAGE],
};

type ReportRow = { id: string; status: ReportStatus; createdAt: Date; targetType: ReportTargetType; targetId: string };

/**
 * Report action coordinator. Loads the report, validates the requested
 * action, performs the moderation mutation, writes an AuditLog, and
 * resolves/dismisses the report — all in one transaction so the three
 * records can never diverge.
 */
@Injectable()
export class ResolveReportService {
  private readonly logger = new Logger(ResolveReportService.name);

  constructor(private readonly prisma: PrismaService) {}

  async resolveReport(moderatorId: string, reportId: string, dto: ResolveReportDto): Promise<ResolveReportResponse> {
    this.logger.log(`[START] Handling report: report=${reportId}, moderator=${moderatorId}, action=${dto.action}`);

    const result = await this.prisma.$transaction(async (tx) => {
      const report = await tx.report.findUnique({
        where: { id: reportId },
        select: { id: true, status: true, createdAt: true, targetType: true, targetId: true },
      });
      if (!report) {
        throw new NotFoundException('Report not found.');
      }
      if (report.status !== ReportStatus.PENDING) {
        throw new ConflictException('This report has already been handled.');
      }

      // Phase 1 — atomic claim. PENDING → REVIEWING via a conditional
      // update: if another moderator already claimed/handled this report,
      // count is 0 and we conflict (and the tx rolls back).
      const claimed = await tx.report.updateMany({
        where: { id: report.id, status: ReportStatus.PENDING },
        data: { status: ReportStatus.REVIEWING },
      });
      if (claimed.count === 0) {
        throw new ConflictException('This report has already been handled.');
      }

      if (!ACTION_ALLOWED_TARGETS[dto.action].includes(report.targetType)) {
        throw new BadRequestException(`Action ${dto.action} is not valid for a ${report.targetType} report.`);
      }

      // The report is the source of truth for the target: the target ID is
      // derived from the report, never accepted from the client.
      // Action itself determines the final status: moderation → RESOLVED,
      // DISMISS → DISMISSED.
      const finalStatus = dto.action === 'DISMISS' ? ReportStatus.DISMISSED : ReportStatus.RESOLVED;

      switch (dto.action) {
        case 'REMOVE_LISTING':
          await this.removeListing(tx, moderatorId, report);
          break;
        case 'SUSPEND_USER':
          await this.suspendUser(tx, moderatorId, report);
          break;
        case 'DELETE_USER':
          await this.deleteUser(tx, moderatorId, report);
          break;
        case 'REMOVE_MESSAGE':
          await this.removeMessage(tx, moderatorId, report);
          break;
        case 'DISMISS':
          await tx.auditLog.create({
            data: {
              actorId: moderatorId,
              action: 'REPORT_DISMISSED',
              target: report.id,
              diff: { reportId: report.id, resolution: dto.resolution },
            },
          });
          break;
      }

      // Phase 2 — final transition must come from REVIEWING (state we
      // claimed), not any status, so nothing but this tx can resolve it.
      const updated = await tx.report.updateMany({
        where: { id: report.id, status: ReportStatus.REVIEWING },
        data: { status: finalStatus, resolution: dto.resolution, resolvedById: moderatorId },
      });
      if (updated.count === 0) {
        throw new ConflictException('This report has already been handled.');
      }

      return {
        id: report.id,
        status: finalStatus,
        action: dto.action,
        resolution: dto.resolution,
        resolvedById: moderatorId,
        createdAt: report.createdAt,
      };
    });

    this.logger.log(`[SUCCESS] Report ${reportId} -> ${dto.action} (${result.status}) by ${moderatorId}`);

    return result;
  }

  private async removeListing(tx: Prisma.TransactionClient, moderatorId: string, report: ReportRow) {
    const listing = await tx.listing.findUnique({
      where: { id: report.targetId },
      select: { id: true, status: true },
    });
    if (!listing) throw new NotFoundException('Target listing not found.');
    if (listing.status === ListingStatus.REMOVED) throw new ConflictException('Listing is already removed.');

    await tx.listing.update({ where: { id: listing.id }, data: { status: ListingStatus.REMOVED } });
    await tx.auditLog.create({
      data: {
        actorId: moderatorId,
        action: 'LISTING_REMOVED',
        target: listing.id,
        diff: { reportId: report.id, from: listing.status, to: ListingStatus.REMOVED },
      },
    });
  }

  private async suspendUser(tx: Prisma.TransactionClient, moderatorId: string, report: ReportRow) {
    const user = await tx.user.findUnique({
      where: { id: report.targetId },
      select: { id: true, status: true, role: true },
    });
    if (!user) throw new NotFoundException('Target user not found.');
    if (user.status === UserStatus.DELETED) throw new ConflictException('User is already deleted.');
    if (user.status === UserStatus.SUSPENDED) throw new ConflictException('User is already suspended.');
    if (user.role === UserRole.ADMIN || user.role === UserRole.MODERATOR) {
      throw new BadRequestException(`Cannot suspend a ${user.role} account through the report flow.`);
    }

    await tx.user.update({ where: { id: user.id }, data: { status: UserStatus.SUSPENDED } });
    await tx.auditLog.create({
      data: {
        actorId: moderatorId,
        action: 'USER_SUSPENDED',
        target: user.id,
        diff: { reportId: report.id, from: user.status, to: UserStatus.SUSPENDED },
      },
    });
  }

  private async deleteUser(tx: Prisma.TransactionClient, moderatorId: string, report: ReportRow) {
    const user = await tx.user.findUnique({
      where: { id: report.targetId },
      select: { id: true, status: true, role: true },
    });
    if (!user) throw new NotFoundException('Target user not found.');
    if (user.status === UserStatus.DELETED) throw new ConflictException('User is already deleted.');
    if (user.role === UserRole.ADMIN || user.role === UserRole.MODERATOR) {
      throw new BadRequestException(`Cannot delete a ${user.role} account through the report flow.`);
    }

    // Soft delete: preserve historical relationships (listings, messages,
    // reservations, reports) by only flipping the status.
    await tx.user.update({ where: { id: user.id }, data: { status: UserStatus.DELETED } });
    await tx.auditLog.create({
      data: {
        actorId: moderatorId,
        action: 'USER_DELETED',
        target: user.id,
        diff: { reportId: report.id, from: user.status, to: UserStatus.DELETED },
      },
    });
  }

  private async removeMessage(tx: Prisma.TransactionClient, moderatorId: string, report: ReportRow) {
    const message = await tx.message.findUnique({
      where: { id: report.targetId },
      select: { id: true, threadId: true, senderId: true },
    });
    if (!message) throw new NotFoundException('Target message not found.');

    // Hard delete: Message has no soft-delete column, and
    // ContactInfoViolation cascades on message delete. The audit entry
    // records only metadata — never the message body.
    await tx.message.delete({ where: { id: message.id } });
    await tx.auditLog.create({
      data: {
        actorId: moderatorId,
        action: 'MESSAGE_REMOVED',
        target: message.id,
        diff: { reportId: report.id, threadId: message.threadId, senderId: message.senderId },
      },
    });
  }
}
