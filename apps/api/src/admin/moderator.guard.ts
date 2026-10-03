import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { TokenPayload } from '../auth/jwt/jwt-token.service.js';
import { UserRole } from '../generated/prisma/enums.js';

/**
 * Requires an authenticated user with MODERATOR or ADMIN role. Must run
 * after AuthGuard('jwt') so req.user is populated.
 */
@Injectable()
export class ModeratorGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user as TokenPayload | undefined;
    if (!user?.sub) {
      throw new UnauthorizedException();
    }

    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.sub },
      select: { role: true },
    });

    if (!dbUser || (dbUser.role !== UserRole.MODERATOR && dbUser.role !== UserRole.ADMIN)) {
      throw new ForbiddenException('You do not have access to this resource.');
    }

    return true;
  }
}
