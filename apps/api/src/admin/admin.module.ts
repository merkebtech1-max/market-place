import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { AdminController } from './admin.controller.js';
import { AdminReportsService } from './services/admin-reports.service.js';
import { ModeratorGuard } from './moderator.guard.js';

@Module({
  imports: [AuthModule],
  controllers: [AdminController],
  providers: [AdminReportsService, ModeratorGuard],
})
export class AdminModule {}
