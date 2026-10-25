import { ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { UserRole, UserStatus } from '../../generated/prisma/enums.js';

/** Safe summary returned after unsuspending a user. */
export interface UnsuspendUserResult {
  id: string;
  displayName: string | null;
  status: UserStatus;
  role: UserRole;
  updatedAt: Date;
}

/**
 * Basic unsuspend: SUSPENDED → ACTIVE only, audited atomically.
 * Moderators/admins cannot unsuspend other MODERATOR/ADMIN accounts.
 * Deleted accounts are restored through a separate operation.
 */
@Injectable()
export class UnsuspendUserService {
  private readonly logger = new Logger(UnsuspendUserService.name);

  constructor(private readonly prisma: PrismaService) {}

  async unsuspendUser(moderatorId: string, userId: string): Promise<UnsuspendUserResult> {
    this.logger.log(`[START] Unsuspending user: user=${userId}, moderator=${moderatorId}`);

    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true, status: true, role: true },
      });

      if (!user) {
        throw new NotFoundException('User not found.');
      }
      if (user.status === UserStatus.ACTIVE) {
        throw new ConflictException('User is not suspended.');
      }
      if (user.status === UserStatus.DELETED) {
        throw new ConflictException('A deleted account must be restored through the separate restore operation.');
      }
      if (user.role === UserRole.ADMIN || user.role === UserRole.MODERATOR) {
        throw new ForbiddenException(`Cannot unsuspend a ${user.role} account.`);
      }

      // Conditional update: only flip SUSPENDED → ACTIVE. If a concurrent
      // moderation request already changed the status, 0 rows match and
      // the transaction rolls back.
      const updated = await tx.user.updateMany({
        where: { id: user.id, status: UserStatus.SUSPENDED },
        data: { status: UserStatus.ACTIVE },
      });
      if (updated.count === 0) {
        throw new ConflictException('User is not suspended.');
      }

      await tx.auditLog.create({
        data: {
          actorId: moderatorId,
          action: 'USER_UNSUSPENDED',
          target: user.id,
          diff: { from: UserStatus.SUSPENDED, to: UserStatus.ACTIVE },
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

    this.logger.log(`[SUCCESS] Unsuspended user=${userId} by moderator=${moderatorId}`);

    return result;
  }
}
