import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';

/**
 * Owns the "block a user" use case. A block row means blocked — there is
 * no BlockStatus. A blocked user may be ACTIVE, SUSPENDED, or DELETED;
 * the block belongs to the blocker, not the target.
 */
@Injectable()
export class BlockUserService {
  private readonly logger = new Logger(BlockUserService.name);

  constructor(private readonly prisma: PrismaService) {}

  async blockUser(blockerId: string, blockedId: string): Promise<{ blockedUserId: string }> {
    this.logger.log(`[START] Block request: blocker=${blockerId}, blocked=${blockedId}`);

    if (blockerId === blockedId) {
      throw new ConflictException('You cannot block yourself.');
    }

    const target = await this.prisma.user.findUnique({
      where: { id: blockedId },
      select: { id: true },
    });
    if (!target) {
      throw new NotFoundException('User not found.');
    }

    const existing = await this.prisma.block.findUnique({
      where: { blockerId_blockedId: { blockerId, blockedId } },
    });
    if (existing) {
      throw new ConflictException('You have already blocked this user.');
    }

    try {
      await this.prisma.block.create({ data: { blockerId, blockedId } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('You have already blocked this user.');
      }
      throw error;
    }

    this.logger.log(`[SUCCESS] Blocked user=${blockedId} by blocker=${blockerId}`);
    return { blockedUserId: blockedId };
  }
}
