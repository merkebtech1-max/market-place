import { CanActivate, ExecutionContext, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { UserStatus } from '../../generated/prisma/enums.js';
import { ThreadModel } from '../../generated/prisma/models/Thread.js';

/** Minimal shape needed to decide thread participation. */
export interface ThreadParticipantCandidate {
  buyerId: string;
  sellerId: string;
}

/**
 * The single, shared definition of what makes a user a thread participant.
 * Reused by this guard and by anything else that must decide access without
 * scattering ad-hoc buyerId/sellerId comparisons around the codebase.
 */
export function isThreadParticipant(thread: ThreadParticipantCandidate, userId: string): boolean {
  return thread.buyerId === userId || thread.sellerId === userId;
}

/**
 * Reusable authorization for thread-scoped routes (GET/POST messages, read
 * status, etc.). Must run after the JWT guard so req.user is populated.
 *
 * - 404 when the thread does not exist
 * - 403 when the caller is not a participant (buyer or seller)
 * - 403 when the caller's account is not ACTIVE (suspended users can still
 *   hold a valid JWT, so this is enforced here on top of the auth guard)
 *
 * On success it loads the thread once and attaches it to req.thread so the
 * handler — and any service it calls — never re-fetches or re-checks access.
 */
@Injectable()
export class ThreadParticipantGuard implements CanActivate {
  private readonly logger = new Logger(ThreadParticipantGuard.name);

  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const currentUser = request.user as { sub: string } | undefined;
    const threadId: string | undefined = request.params?.id;

    if (!currentUser) {
      throw new ForbiddenException('Authentication is required to access this conversation.');
    }
    if (!threadId) {
      throw new NotFoundException('Missing thread ID in the request.');
    }

    const thread = await this.prisma.thread.findUnique({
      where: { id: threadId },
      select: {
        id: true,
        listingId: true,
        buyerId: true,
        sellerId: true,
        unlockedAt: true,
        lastMessageAt: true,
        createdAt: true,
      },
    });
    if (!thread) throw new NotFoundException(`Thread with ID ${threadId} not found.`);

    if (!isThreadParticipant(thread, currentUser.sub)) {
      this.logger.warn(`[ACCESS] Denied non-participant: userId=${currentUser.sub}, threadId=${threadId}`);
      throw new ForbiddenException('You do not have access to this conversation.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: currentUser.sub },
      select: { status: true },
    });
    if (!user || user.status !== UserStatus.ACTIVE) {
      this.logger.warn(`[ACCESS] Denied inactive participant: userId=${currentUser.sub}, threadId=${threadId}`);
      throw new ForbiddenException('Your account is not active, so you cannot access conversations.');
    }

    request.thread = thread as ThreadModel;
    return true;
  }
}