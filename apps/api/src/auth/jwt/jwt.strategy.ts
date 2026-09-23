import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { TokenPayload } from './jwt-token.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { BANNED_ACCOUNT_MESSAGE, isBannedStatus } from '../common/account-status.js';

/**
 * Passport JWT strategy for validating Bearer tokens.
 * Extracts the JWT from the Authorization header, verifies it using Passport's built-in JWT verification,
 * then confirms the user account is still active and can access protected endpoints.
 * Returns the payload (sub, phone, sessionId) for use in guards.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      algorithms: ['HS256'], // Prevent algorithm confusion attacks
      secretOrKeyProvider: async (_request: any, _rawJwtToken: string, done: (err: any, secret: string) => void) => {
        done(null, config.getOrThrow<string>('JWT_SECRET'));
      },
    });
  }

  /**
   * Validates the JWT payload after the token has been verified by Passport.
   * Loads the user and rejects accounts that have been deleted/banned — even if they
   * already held a token before the ban. Returns the payload which Passport attaches to req.user.
   */
  async validate(payload: TokenPayload): Promise<TokenPayload> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { status: true },
    });

    if (!user) {
      this.logger.warn(`[AUTH] User no longer exists for token: userId=${payload.sub}`);
      throw new UnauthorizedException('Authentication failed. Please log in again.');
    }

    if (isBannedStatus(user.status)) {
      this.logger.warn(`[AUTH] Banned user blocked from protected endpoint: userId=${payload.sub}`);
      throw new UnauthorizedException(BANNED_ACCOUNT_MESSAGE);
    }

    this.logger.log(`JWT validated for userId=${payload.sub} sessionId=${payload.sessionId}`);
    return payload;
  }
}