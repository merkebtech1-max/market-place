import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ReportStatus, UserStatus } from '../../generated/prisma/enums.js';
import { CreateReportDto } from '../dto/create-report.dto.js';

/** Safe report representation returned to the reporter. */
export interface ReportResponse {
  id: string;
  targetType: string;
  targetId: string;
  reason: string;
  note: string | null;
  status: ReportStatus;
  createdAt: Date;
}

/**
 * Owns report creation for LISTING, USER, and MESSAGE targets.
 * Validates reporter and target, derives server-owned values, applies the
 * V1 duplicate rule (no second PENDING report for the same target by the
 * same reporter), then persists a single Report row.
 */
@Injectable()
export class CreateReportService {
  private readonly logger = new Logger(CreateReportService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createReport(reporterId: string, dto: CreateReportDto): Promise<ReportResponse> {
    this.logger.log(`[START] Creating report: reporter=${reporterId}, targetType=${dto.targetType}, targetId=${dto.targetId}`);

    try {
      const reporter = await this.prisma.user.findUnique({
        where: { id: reporterId },
        select: { id: true, status: true },
      });
      if (!reporter) {
        throw new NotFoundException('Reporter account not found.');
      }
      if (reporter.status !== UserStatus.ACTIVE) {
        throw new BadRequestException('Your account is not active, so you cannot submit reports.');
      }

      // Validate target and derive server-owned fields.
      let listingId: string | null = null;

      switch (dto.targetType) {
        case 'LISTING': {
          const listing = await this.prisma.listing.findUnique({
            where: { id: dto.targetId },
            select: { id: true, sellerId: true },
          });
          if (!listing) throw new NotFoundException('Listing not found.');
          if (listing.sellerId === reporterId) {
            throw new BadRequestException('You cannot report your own listing.');
          }
          listingId = listing.id;
          break;
        }
        case 'USER': {
          if (dto.targetId === reporterId) {
            throw new BadRequestException('You cannot report yourself.');
          }
          const targetUser = await this.prisma.user.findUnique({
            where: { id: dto.targetId },
            select: { id: true },
          });
          if (!targetUser) throw new NotFoundException('User not found.');
          break;
        }
        case 'MESSAGE': {
          const message = await this.prisma.message.findUnique({
            where: { id: dto.targetId },
            select: { id: true, senderId: true, thread: { select: { buyerId: true, sellerId: true } } },
          });
          if (!message) throw new NotFoundException('Message not found.');
          const isParticipant =
            message.thread.buyerId === reporterId || message.thread.sellerId === reporterId;
          if (!isParticipant) {
            // Do not reveal which side the reporter is on — the message is
            // simply not reportable by them.
            throw new ForbiddenException('You cannot report this message.');
          }
          if (message.senderId === reporterId) {
            throw new BadRequestException('You cannot report your own message.');
          }
          break;
        }
      }

      // V1 duplicate rule: no second PENDING report for the same target.
      // Note: no DB unique constraint yet, so this is not race-safe —
      // revisit with moderation/admin workflows.
      const pendingDuplicate = await this.prisma.report.findFirst({
        where: {
          reporterId,
          targetType: dto.targetType,
          targetId: dto.targetId,
          status: ReportStatus.PENDING,
        },
      });
      if (pendingDuplicate) {
        throw new ConflictException('You already have a pending report for this target.');
      }

      const report = await this.prisma.report.create({
        data: {
          reporterId,
          targetType: dto.targetType,
          targetId: dto.targetId,
          listingId,
          reason: dto.reason,
          note: dto.note,
          status: ReportStatus.PENDING,
        },
      });

      this.logger.log(`[SUCCESS] Report created: reportId=${report.id}`);

      return {
        id: report.id,
        targetType: report.targetType,
        targetId: report.targetId,
        reason: report.reason,
        note: report.note,
        status: report.status,
        createdAt: report.createdAt,
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException ||
        error instanceof ForbiddenException ||
        error instanceof ConflictException
      ) {
        throw error;
      }

      this.logger.error(
        `[ERROR] Failed to create report: reporterId=${reporterId} - ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw new InternalServerErrorException(
        'Unable to submit your report at this time. Please try again later.',
      );
    }
  }
}
