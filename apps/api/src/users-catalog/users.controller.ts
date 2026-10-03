import { Controller, Delete, Get, Logger, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { TokenPayload } from '../auth/jwt/jwt-token.service.js';
import { BlockUserService } from './services/block-user.service.js';
import { UnblockUserService } from './services/unblock-user.service.js';
import { GetBlockedUsersService, type BlockedUserSummary } from './services/get-blocked-users.service.js';
import { CreateReportDto } from './dto/create-report.dto.js';
import { CreateReportService, type ReportResponse } from './services/create-report.service.js';
import { Body } from '@nestjs/common';

@Controller('users')
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(
    private readonly blockUserService: BlockUserService,
    private readonly unblockUserService: UnblockUserService,
    private readonly getBlockedUsersService: GetBlockedUsersService,
    private readonly createReportService: CreateReportService,
  ) {}

  @Post('block/:userId')
  @UseGuards(AuthGuard('jwt'))
  async blockUser(
    @Param('userId') userId: string,
    @CurrentUser() user: TokenPayload,
  ): Promise<{ success: true; data: { blockedUserId: string } }> {
    this.logger.log(`[REQUEST] POST /users/block/${userId} - userId=${user.sub}`);
    const data = await this.blockUserService.blockUser(user.sub, userId);
    return { success: true, data };
  }

  @Delete('block/:userId')
  @UseGuards(AuthGuard('jwt'))
  async unblockUser(
    @Param('userId') userId: string,
    @CurrentUser() user: TokenPayload,
  ): Promise<{ success: true; data: { blockedUserId: string } }> {
    this.logger.log(`[REQUEST] DELETE /users/block/${userId} - userId=${user.sub}`);
    const data = await this.unblockUserService.unblockUser(user.sub, userId);
    return { success: true, data };
  }

  @Get('blocked')
  @UseGuards(AuthGuard('jwt'))
  async getBlockedUsers(
    @CurrentUser() user: TokenPayload,
  ): Promise<{ success: true; data: BlockedUserSummary[] }> {
    this.logger.log(`[REQUEST] GET /users/blocked - userId=${user.sub}`);
    const data = await this.getBlockedUsersService.getBlockedUsers(user.sub);
    return { success: true, data };
  }

  @Post('reports')
  @UseGuards(AuthGuard('jwt'))
  async createReport(
    @Body() dto: CreateReportDto,
    @CurrentUser() user: TokenPayload,
  ): Promise<{ success: true; data: ReportResponse }> {
    this.logger.log(`[REQUEST] POST /users/reports - userId=${user.sub}, targetType=${dto.targetType}, targetId=${dto.targetId}`);
    const data = await this.createReportService.createReport(user.sub, dto);
    this.logger.log(`[RESPONSE] POST /users/reports - reportId=${data.id}`);
    return { success: true, data };
  }
}
