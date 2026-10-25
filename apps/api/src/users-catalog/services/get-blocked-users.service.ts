import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

/** Public-profile representation of a blocked user. */
export interface BlockedUserSummary {
  id: string;
  displayName: string;
  avatarKey: string | null;
  bio: string | null;
}

/**
 * Lists the users the authenticated user has blocked. Exposes only the
 * public profile fields — no phone, status, or internal details.
 */
@Injectable()
export class GetBlockedUsersService {
  private readonly logger = new Logger(GetBlockedUsersService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getBlockedUsers(blockerId: string): Promise<BlockedUserSummary[]> {
    this.logger.log(`[START] Listing blocked users for blocker=${blockerId}`);

    const blocks = await this.prisma.block.findMany({
      where: { blockerId },
      orderBy: { createdAt: 'desc' },
      select: {
        blocked: {
          select: { id: true, displayName: true, avatarKey: true, bio: true },
        },
      },
    });

    return blocks.map((block) => block.blocked);
  }
}
