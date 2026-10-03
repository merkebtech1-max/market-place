import { Body, Controller, Get, Logger, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ListReportsDto } from './dto/list-reports.dto.js';
import { AdminReportsService, type AdminReportView } from './services/admin-reports.service.js';
import { ResolveReportService, type ResolveReportResponse } from './services/resolve-report.service.js';
import { ResolveReportDto } from './dto/resolve-report.dto.js';
import { ModeratorGuard } from './moderator.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { TokenPayload } from '../auth/jwt/jwt-token.service.js';

@Controller('admin')
export class AdminController {
  private readonly logger = new Logger(AdminController.name);

  constructor(
    private readonly adminReportsService: AdminReportsService,
    private readonly resolveReportService: ResolveReportService,
  ) {}

  @Get('reports')
  @UseGuards(AuthGuard('jwt'), ModeratorGuard)
  async listReports(@Query() query: ListReportsDto): Promise<{ success: true; data: AdminReportView[] }> {
    this.logger.log(`[REQUEST] GET /admin/reports - status=${query.status ?? 'PENDING'}, targetType=${query.targetType ?? 'all'}`);
    const data = await this.adminReportsService.listReports(query);
    this.logger.log(`[RESPONSE] GET /admin/reports - count=${data.length}`);
    return { success: true, data };
  }

  @Patch('reports/:reportId')
  @UseGuards(AuthGuard('jwt'), ModeratorGuard)
  async resolveReport(
    @Param('reportId') reportId: string,
    @Body() dto: ResolveReportDto,
    @CurrentUser() user: TokenPayload,
  ): Promise<{ success: true; data: ResolveReportResponse }> {
    this.logger.log(`[REQUEST] PATCH /admin/reports/${reportId} - moderator=${user.sub}, outcome=${dto.status}`);
    const data = await this.resolveReportService.resolveReport(user.sub, reportId, dto);
    this.logger.log(`[RESPONSE] PATCH /admin/reports/${reportId} - status=${data.status}`);
    return { success: true, data };
  }
}
