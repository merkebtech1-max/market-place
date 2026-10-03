import { Controller, Get, Logger, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ListReportsDto } from './dto/list-reports.dto.js';
import { AdminReportsService, type AdminReportView } from './services/admin-reports.service.js';
import { ModeratorGuard } from './moderator.guard.js';

@Controller('admin')
export class AdminController {
  private readonly logger = new Logger(AdminController.name);

  constructor(private readonly adminReportsService: AdminReportsService) {}

  @Get('reports')
  @UseGuards(AuthGuard('jwt'), ModeratorGuard)
  async listReports(@Query() query: ListReportsDto): Promise<{ success: true; data: AdminReportView[] }> {
    this.logger.log(`[REQUEST] GET /admin/reports - status=${query.status ?? 'PENDING'}, targetType=${query.targetType ?? 'all'}`);
    const data = await this.adminReportsService.listReports(query);
    this.logger.log(`[RESPONSE] GET /admin/reports - count=${data.length}`);
    return { success: true, data };
  }
}
