import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

/**
 * Reusable "are these two users blocked from interacting?" check.
 * Blocking rows are directional, but interaction blocking is mutual:
 * a block from A → B also blocks B → A. Messaging should consult this
 * single check before allowing either direction.
 */
@Injectable()
export class BlockCheckService {
  private readonly logger = new Logger(BlockCheckService.name);

  constructor(private readonly prisma: PrismaService) {}

  async isBlocked(userAId: string, userBId: string): Promise<boolean> {
    const block = await this.prisma.block.findFirst({
      where: {
        OR: [
          { blockerId: userAId, blockedId: userBId },
          { blockerId: userBId, blockedId: userAId },
        ],
      },
      select: { id: true },
    });

    return block !== null;
  }
}
