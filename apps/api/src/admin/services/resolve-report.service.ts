import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ReportStatus } from '../../generated/prisma/enums.js';
import { ResolveReportDto } from '../dto/resolve-report.dto.js';

/** Minimal safe view of a resolved/dismissed report. */
export interface ResolveReportResponse {
  id: string;
  status: ReportStatus;
  resolution: string;
  resolvedById: string;
  createdAt: Date;
}

@Injectable()
export class ResolveReportService {
  private readonly logger = new Logger(ResolveReportService.name);

  constructor(private readonly prisma: PrismaService) {}

  async resolveReport(moderatorId: string, reportId: string, dto: ResolveReportDto): Promise<ResolveReportResponse> {
    this.logger.log(`[START] Resolving report: report=${reportId}, moderator=${moderatorId}, outcome=${dto.status}`);

    const report = await this.prisma.report.findUnique({
      where: { id: reportId },
      select: { id: true, status: true, createdAt: true },
    });
    if (!report) {
      throw new NotFoundException('Report not found.');
    }
    if (report.status !== ReportStatus.PENDING) {
      throw new ConflictException('This report has already been handled.');
    }

    // Concurrency guard: the write itself requires status = PENDING, so a
    // second moderator racing us updates 0 rows and gets the conflict.
    const result = await this.prisma.report.updateMany({
      where: { id: reportId, status: ReportStatus.PENDING },
      data: {
        status: dto.status,
        resolution: dto.resolution,
        resolvedById: moderatorId,
      },
    });
    if (result.count === 0) {
      throw new ConflictException('This report has already been handled.');
    }

    this.logger.log(`[SUCCESS] Report ${reportId} → ${dto.status} by ${moderatorId}`);

    return {
      id: reportId,
      status: dto.status,
      resolution: dto.resolution,
      resolvedById: moderatorId,
      createdAt: report.createdAt,
    };
  }
}
