import { ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { UserRole, UserStatus } from '../../generated/prisma/enums.js';

/** Safe summary returned after suspending a user. */
export interface SuspendUserResult {
  id: string;
  displayName: string | null;
  status: UserStatus;
  role: UserRole;
  updatedAt: Date;
}

/**
 * First-version user suspension: ACTIVE → SUSPENDED only, audited
 * atomically. Moderators/admins cannot suspend other MODERATOR/ADMIN
 * accounts.
 */
@Injectable()
export class SuspendUserService {
  private readonly logger = new Logger(SuspendUserService.name);

  constructor(private readonly prisma: PrismaService) {}

  async suspendUser(moderatorId: string, userId: string): Promise<SuspendUserResult> {
    this.logger.log(`[START] Suspending user: user=${userId}, moderator=${moderatorId}`);

    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true, status: true, role: true },
      });

      if (!user) {
        throw new NotFoundException('User not found.');
      }
      if (user.status === UserStatus.SUSPENDED) {
        throw new ConflictException('User is already suspended.');
      }
      if (user.status === UserStatus.DELETED) {
        throw new ConflictException('Cannot suspend a deleted account.');
      }
      if (user.role === UserRole.ADMIN || user.role === UserRole.MODERATOR) {
        throw new ForbiddenException(`Cannot suspend a ${user.role} account.`);
      }

      // Conditional update: only flip ACTIVE → SUSPENDED. If a concurrent
      // moderation request already changed the status, 0 rows match and
      // the transaction rolls back.
      const updated = await tx.user.updateMany({
        where: { id: user.id, status: UserStatus.ACTIVE },
        data: { status: UserStatus.SUSPENDED },
      });
      if (updated.count === 0) {
        throw new ConflictException('User is not active.');
      }

      await tx.auditLog.create({
        data: {
          actorId: moderatorId,
          action: 'USER_SUSPENDED',
          target: user.id,
          diff: { from: UserStatus.ACTIVE, to: UserStatus.SUSPENDED },
        },
      });

      return tx.user.findUnique({
        where: { id: user.id },
        select: { id: true, displayName: true, status: true, role: true, updatedAt: true },
      });
    });

    if (!result) {
      // Unreachable in practice (the user was just updated), but keeps the type honest.
      throw new NotFoundException('User not found.');
    }

    this.logger.log(`[SUCCESS] Suspended user=${userId} by moderator=${moderatorId}`);

    return result;
  }
}
