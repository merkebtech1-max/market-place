import { ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { UserRole, UserStatus } from '../../generated/prisma/enums.js';

/** Safe summary returned after deleting a user. */
export interface DeleteUserResult {
  id: string;
  displayName: string | null;
  status: UserStatus;
  role: UserRole;
  updatedAt: Date;
}

/**
 * Soft delete: ACTIVE/SUSPENDED → DELETED only — the User row is kept,
 * nothing cascades. Moderators/admins cannot delete MODERATOR/ADMIN
 * accounts.
 */
@Injectable()
export class DeleteUserService {
  private readonly logger = new Logger(DeleteUserService.name);

  constructor(private readonly prisma: PrismaService) {}

  async deleteUser(moderatorId: string, userId: string): Promise<DeleteUserResult> {
    this.logger.log(`[START] Deleting user: user=${userId}, moderator=${moderatorId}`);

    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true, status: true, role: true },
      });

      if (!user) {
        throw new NotFoundException('User not found.');
      }
      if (user.status === UserStatus.DELETED) {
        throw new ConflictException('User is already deleted.');
      }
      if (user.role === UserRole.ADMIN || user.role === UserRole.MODERATOR) {
        throw new ForbiddenException(`Cannot delete a ${user.role} account.`);
      }

      // Conditional update: only from ACTIVE or SUSPENDED. If a concurrent
      // moderation request already changed the status, 0 rows match and
      // the transaction rolls back.
      const updated = await tx.user.updateMany({
        where: { id: user.id, status: { in: [UserStatus.ACTIVE, UserStatus.SUSPENDED] } },
        data: { status: UserStatus.DELETED },
      });
      if (updated.count === 0) {
        throw new ConflictException('User is already deleted.');
      }

      await tx.auditLog.create({
        data: {
          actorId: moderatorId,
          action: 'USER_DELETED',
          target: user.id,
          diff: { from: user.status, to: UserStatus.DELETED },
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

    this.logger.log(`[SUCCESS] Deleted user=${userId} by moderator=${moderatorId}`);

    return result;
  }
}
