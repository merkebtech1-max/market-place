import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { AdminController } from './admin.controller.js';
import { AdminReportsService } from './services/admin-reports.service.js';
import { ResolveReportService } from './services/resolve-report.service.js';
import { AdminUsersService } from './services/admin-users.service.js';
import { AdminListingsService } from './services/admin-listings.service.js';
import { RemoveListingService } from './services/remove-listing.service.js';
import { RestoreListingService } from './services/restore-listing.service.js';
import { SuspendUserService } from './services/suspend-user.service.js';
import { UnsuspendUserService } from './services/unsuspend-user.service.js';
import { DeleteUserService } from './services/delete-user.service.js';
import { RestoreUserService } from './services/restore-user.service.js';
import { ModeratorGuard } from './moderator.guard.js';

@Module({
  imports: [AuthModule],
  controllers: [AdminController],
  providers: [AdminReportsService, AdminUsersService, AdminListingsService, ResolveReportService, SuspendUserService, UnsuspendUserService, DeleteUserService, RestoreUserService, RemoveListingService, RestoreListingService, ModeratorGuard],
})
export class AdminModule {}
