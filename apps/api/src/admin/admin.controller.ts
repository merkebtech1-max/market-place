import { Body, Controller, Get, Logger, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ListReportsDto } from './dto/list-reports.dto.js';
import { ListUsersDto } from './dto/list-users.dto.js';
import { ListListingsDto } from './dto/list-listings.dto.js';
import { ListAuditLogsDto } from './dto/list-audit-logs.dto.js';
import { AdminReportsService, type AdminReportView, type AdminReportDetail } from './services/admin-reports.service.js';
import { AdminUsersService, type AdminUserDetail, type AdminUserSummary, type AdminUsersPage } from './services/admin-users.service.js';
import { SuspendUserService, type SuspendUserResult } from './services/suspend-user.service.js';
import { UnsuspendUserService, type UnsuspendUserResult } from './services/unsuspend-user.service.js';
import { AdminListingsService, type AdminListingDetail, type AdminListingSummary, type AdminListingsPage } from './services/admin-listings.service.js';
import { AdminOverviewService, type AdminOverview } from './services/admin-overview.service.js';
import { AdminAuditLogsService, type AuditLogEntry, type AdminAuditLogsPage } from './services/admin-audit-logs.service.js';
import { RemoveListingService, type RemoveListingResult } from './services/remove-listing.service.js';
import { RestoreListingService, type RestoreListingResult } from './services/restore-listing.service.js';
import { DeleteUserService, type DeleteUserResult } from './services/delete-user.service.js';
import { RestoreUserService, type RestoreUserResult } from './services/restore-user.service.js';
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
    private readonly adminUsersService: AdminUsersService,
    private readonly adminListingsService: AdminListingsService,
    private readonly adminOverviewService: AdminOverviewService,
    private readonly adminAuditLogsService: AdminAuditLogsService,
    private readonly removeListingService: RemoveListingService,
    private readonly restoreListingService: RestoreListingService,
    private readonly suspendUserService: SuspendUserService,
    private readonly unsuspendUserService: UnsuspendUserService,
    private readonly deleteUserService: DeleteUserService,
    private readonly restoreUserService: RestoreUserService,
  ) {}

  @Get('overview')
  @UseGuards(AuthGuard('jwt'), ModeratorGuard)
  async getOverview(): Promise<{ success: true; data: AdminOverview }> {
    this.logger.log('[REQUEST] GET /admin/overview');
    const data = await this.adminOverviewService.getOverview();
    this.logger.log(`[RESPONSE] GET /admin/overview - users=${data.users.total}, listings=${data.listings.total}`);
    return { success: true, data };
  }

  @Get('audit-logs')
  @UseGuards(AuthGuard('jwt'), ModeratorGuard)
  async listAuditLogs(
    @Query() query: ListAuditLogsDto,
  ): Promise<{ success: true; data: AuditLogEntry[]; pagination: AdminAuditLogsPage['pagination'] }> {
    this.logger.log(`[REQUEST] GET /admin/audit-logs - action=${query.action ?? 'any'}, page=${query.page}, limit=${query.limit}`);
    const { data, pagination } = await this.adminAuditLogsService.listAuditLogs(query);
    this.logger.log(`[RESPONSE] GET /admin/audit-logs - count=${data.length}, total=${pagination.total}`);
    return { success: true, data, pagination };
  }

  @Get('listings')
  @UseGuards(AuthGuard('jwt'), ModeratorGuard)
  async listListings(
    @Query() query: ListListingsDto,
  ): Promise<{ success: true; data: AdminListingSummary[]; pagination: AdminListingsPage['pagination'] }> {
    this.logger.log(`[REQUEST] GET /admin/listings - search=${query.search ?? 'none'}, status=${query.status}, page=${query.page}, limit=${query.limit}`);
    const { data, pagination } = await this.adminListingsService.listListings(query);
    this.logger.log(`[RESPONSE] GET /admin/listings - count=${data.length}, total=${pagination.total}`);
    return { success: true, data, pagination };
  }

  @Get('listings/:listingId')
  @UseGuards(AuthGuard('jwt'), ModeratorGuard)
  async getListingDetail(@Param('listingId') listingId: string): Promise<{ success: true; data: AdminListingDetail }> {
    this.logger.log(`[REQUEST] GET /admin/listings/${listingId}`);
    const data = await this.adminListingsService.getListingDetail(listingId);
    this.logger.log(`[RESPONSE] GET /admin/listings/${listingId} - status=${data.status}`);
    return { success: true, data };
  }

  @Patch('listings/:listingId/remove')
  @UseGuards(AuthGuard('jwt'), ModeratorGuard)
  async removeListing(
    @Param('listingId') listingId: string,
    @CurrentUser() user: TokenPayload,
  ): Promise<{ success: true; data: RemoveListingResult }> {
    this.logger.log(`[REQUEST] PATCH /admin/listings/${listingId}/remove - moderator=${user.sub}`);
    const data = await this.removeListingService.removeListing(user.sub, listingId);
    this.logger.log(`[RESPONSE] PATCH /admin/listings/${listingId}/remove - status=${data.status}`);
    return { success: true, data };
  }

  @Patch('listings/:listingId/restore')
  @UseGuards(AuthGuard('jwt'), ModeratorGuard)
  async restoreListing(
    @Param('listingId') listingId: string,
    @CurrentUser() user: TokenPayload,
  ): Promise<{ success: true; data: RestoreListingResult }> {
    this.logger.log(`[REQUEST] PATCH /admin/listings/${listingId}/restore - moderator=${user.sub}`);
    const data = await this.restoreListingService.restoreListing(user.sub, listingId);
    this.logger.log(`[RESPONSE] PATCH /admin/listings/${listingId}/restore - status=${data.status}`);
    return { success: true, data };
  }

  @Get('users')
  @UseGuards(AuthGuard('jwt'), ModeratorGuard)
  async listUsers(@Query() query: ListUsersDto): Promise<{ success: true; data: AdminUserSummary[]; pagination: AdminUsersPage['pagination'] }> {
    this.logger.log(`[REQUEST] GET /admin/users - search=${query.search ?? 'none'}, status=${query.status}, role=${query.role}, sort=${query.sort}, page=${query.page}, limit=${query.limit}`);
    const { data, pagination } = await this.adminUsersService.listUsers(query);
    this.logger.log(`[RESPONSE] GET /admin/users - count=${data.length}, total=${pagination.total}`);
    return { success: true, data, pagination };
  }

  @Get('users/:userId')
  @UseGuards(AuthGuard('jwt'), ModeratorGuard)
  async getUserDetail(@Param('userId') userId: string): Promise<{ success: true; data: AdminUserDetail }> {
    this.logger.log(`[REQUEST] GET /admin/users/${userId}`);
    const data = await this.adminUsersService.getUserDetail(userId);
    this.logger.log(`[RESPONSE] GET /admin/users/${userId} - status=${data.status}`);
    return { success: true, data };
  }

  @Patch('users/:userId/suspend')
  @UseGuards(AuthGuard('jwt'), ModeratorGuard)
  async suspendUser(
    @Param('userId') userId: string,
    @CurrentUser() user: TokenPayload,
  ): Promise<{ success: true; data: SuspendUserResult }> {
    this.logger.log(`[REQUEST] PATCH /admin/users/${userId}/suspend - moderator=${user.sub}`);
    const data = await this.suspendUserService.suspendUser(user.sub, userId);
    this.logger.log(`[RESPONSE] PATCH /admin/users/${userId}/suspend - status=${data.status}`);
    return { success: true, data };
  }

  @Patch('users/:userId/unsuspend')
  @UseGuards(AuthGuard('jwt'), ModeratorGuard)
  async unsuspendUser(
    @Param('userId') userId: string,
    @CurrentUser() user: TokenPayload,
  ): Promise<{ success: true; data: UnsuspendUserResult }> {
    this.logger.log(`[REQUEST] PATCH /admin/users/${userId}/unsuspend - moderator=${user.sub}`);
    const data = await this.unsuspendUserService.unsuspendUser(user.sub, userId);
    this.logger.log(`[RESPONSE] PATCH /admin/users/${userId}/unsuspend - status=${data.status}`);
    return { success: true, data };
  }

  @Patch('users/:userId/delete')
  @UseGuards(AuthGuard('jwt'), ModeratorGuard)
  async deleteUser(
    @Param('userId') userId: string,
    @CurrentUser() user: TokenPayload,
  ): Promise<{ success: true; data: DeleteUserResult }> {
    this.logger.log(`[REQUEST] PATCH /admin/users/${userId}/delete - moderator=${user.sub}`);
    const data = await this.deleteUserService.deleteUser(user.sub, userId);
    this.logger.log(`[RESPONSE] PATCH /admin/users/${userId}/delete - status=${data.status}`);
    return { success: true, data };
  }

  @Patch('users/:userId/restore')
  @UseGuards(AuthGuard('jwt'), ModeratorGuard)
  async restoreUser(
    @Param('userId') userId: string,
    @CurrentUser() user: TokenPayload,
  ): Promise<{ success: true; data: RestoreUserResult }> {
    this.logger.log(`[REQUEST] PATCH /admin/users/${userId}/restore - moderator=${user.sub}`);
    const data = await this.restoreUserService.restoreUser(user.sub, userId);
    this.logger.log(`[RESPONSE] PATCH /admin/users/${userId}/restore - status=${data.status}`);
    return { success: true, data };
  }

  @Get('reports')
  @UseGuards(AuthGuard('jwt'), ModeratorGuard)
  async listReports(@Query() query: ListReportsDto): Promise<{ success: true; data: AdminReportView[] }> {
    this.logger.log(`[REQUEST] GET /admin/reports - status=${query.status ?? 'PENDING'}, targetType=${query.targetType ?? 'all'}`);
    const data = await this.adminReportsService.listReports(query);
    this.logger.log(`[RESPONSE] GET /admin/reports - count=${data.length}`);
    return { success: true, data };
  }

  @Get('reports/:reportId')
  @UseGuards(AuthGuard('jwt'), ModeratorGuard)
  async getReportDetail(@Param('reportId') reportId: string): Promise<{ success: true; data: AdminReportDetail }> {
    this.logger.log(`[REQUEST] GET /admin/reports/${reportId}`);
    const data = await this.adminReportsService.getReportDetail(reportId);
    this.logger.log(`[RESPONSE] GET /admin/reports/${reportId} - targetType=${data.targetType}`);
    return { success: true, data };
  }

  @Patch('reports/:reportId')
  @UseGuards(AuthGuard('jwt'), ModeratorGuard)
  async resolveReport(
    @Param('reportId') reportId: string,
    @Body() dto: ResolveReportDto,
    @CurrentUser() user: TokenPayload,
  ): Promise<{ success: true; data: ResolveReportResponse }> {
    this.logger.log(`[REQUEST] PATCH /admin/reports/${reportId} - moderator=${user.sub}, action=${dto.action}`);
    const data = await this.resolveReportService.resolveReport(user.sub, reportId, dto);
    this.logger.log(`[RESPONSE] PATCH /admin/reports/${reportId} - status=${data.status}`);
    return { success: true, data };
  }
}
