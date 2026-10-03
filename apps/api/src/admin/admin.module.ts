import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { AdminController } from './admin.controller.js';
import { AdminReportsService } from './services/admin-reports.service.js';
import { ResolveReportService } from './services/resolve-report.service.js';
import { ModeratorGuard } from './moderator.guard.js';

@Module({
  imports: [AuthModule],
  controllers: [AdminController],
  providers: [AdminReportsService, ResolveReportService, ModeratorGuard],
})
export class AdminModule {}
