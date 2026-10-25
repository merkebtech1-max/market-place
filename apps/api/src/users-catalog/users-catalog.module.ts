import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { UsersController } from './users.controller.js';
import { BlockUserService } from './services/block-user.service.js';
import { UnblockUserService } from './services/unblock-user.service.js';
import { GetBlockedUsersService } from './services/get-blocked-users.service.js';
import { BlockCheckService } from './services/block-check.service.js';
import { CreateReportService } from './services/create-report.service.js';

@Module({
  imports: [AuthModule],
  controllers: [UsersController],
  providers: [BlockUserService, UnblockUserService, GetBlockedUsersService, BlockCheckService, CreateReportService],
  exports: [BlockCheckService],
})
export class UsersCatalogModule {}
