import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

/**
 * Owns the "unblock a user" use case. Only the blocker (the authenticated
 * user) can remove their own block; a block they didn't create, or one
 * that doesn't exist, is a 404.
 */
@Injectable()
export class UnblockUserService {
  private readonly logger = new Logger(UnblockUserService.name);

  constructor(private readonly prisma: PrismaService) {}

  async unblockUser(blockerId: string, blockedId: string): Promise<{ blockedUserId: string }> {
    this.logger.log(`[START] Unblock request: blocker=${blockerId}, blocked=${blockedId}`);

    // Atomic, conditional delete: no prior findUnique, so no
    // read-then-delete race. 0 rows means the block never existed
    // (or was created by someone else — same 404 from the caller's view).
    const result = await this.prisma.block.deleteMany({
      where: { blockerId, blockedId },
    });
    if (result.count === 0) {
      throw new NotFoundException('Block not found.');
    }

    this.logger.log(`[SUCCESS] Unblocked user=${blockedId} by blocker=${blockerId}`);
    return { blockedUserId: blockedId };
  }
}
