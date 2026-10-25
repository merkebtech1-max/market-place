import { ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { UserRole, UserStatus } from '../../generated/prisma/enums.js';

/** Safe summary returned after restoring a user. */
export interface RestoreUserResult {
  id: string;
  displayName: string | null;
  status: UserStatus;
  role: UserRole;
  updatedAt: Date;
}

/**
 * Counterpart to soft delete: DELETED → ACTIVE only. Does not silently
 * unsuspend. Moderators/admins cannot restore MODERATOR/ADMIN accounts.
 */
@Injectable()
export class RestoreUserService {
  private readonly logger = new Logger(RestoreUserService.name);

  constructor(private readonly prisma: PrismaService) {}

  async restoreUser(moderatorId: string, userId: string): Promise<RestoreUserResult> {
    this.logger.log(`[START] Restoring user: user=${userId}, moderator=${moderatorId}`);

    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true, status: true, role: true },
      });

      if (!user) {
        throw new NotFoundException('User not found.');
      }
      if (user.status === UserStatus.ACTIVE) {
        throw new ConflictException('User is not deleted.');
      }
      if (user.status === UserStatus.SUSPENDED) {
        throw new ConflictException('Cannot restore a suspended account; use unsuspend instead.');
      }
      if (user.role === UserRole.ADMIN || user.role === UserRole.MODERATOR) {
        throw new ForbiddenException(`Cannot restore a ${user.role} account.`);
      }

      // Conditional update: only DELETED → ACTIVE. If a concurrent
      // moderation request already changed the status, 0 rows match and
      // the transaction rolls back.
      const updated = await tx.user.updateMany({
        where: { id: user.id, status: UserStatus.DELETED },
        data: { status: UserStatus.ACTIVE },
      });
      if (updated.count === 0) {
        throw new ConflictException('User is not deleted.');
      }

      await tx.auditLog.create({
        data: {
          actorId: moderatorId,
          action: 'USER_RESTORED',
          target: user.id,
          diff: { from: UserStatus.DELETED, to: UserStatus.ACTIVE },
        },
      });

      return tx.user.findUnique({
        where: { id: user.id },
        select: { id: true, displayName: true, status: true, role: true, updatedAt: true },
      });
    });

    if (!result) {
      throw new NotFoundException('User not found.');
    }

    this.logger.log(`[SUCCESS] Restored user=${userId} by moderator=${moderatorId}`);

    return result;
  }
}
