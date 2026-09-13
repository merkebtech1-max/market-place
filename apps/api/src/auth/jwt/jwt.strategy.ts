import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { TokenPayload } from './jwt-token.service.js';

/**
 * Passport JWT strategy for validating Bearer tokens.
 * Extracts the JWT from the Authorization header, verifies it using Passport's built-in JWT verification,
 * and returns the payload (sub, phone, sessionId) for use in guards.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(private readonly config: ConfigService) {
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
   * Returns the payload which will be attached to req.user by Passport.
   */
  async validate(payload: TokenPayload): Promise<TokenPayload> {
    try {
      this.logger.log(`JWT validated for userId=${payload.sub} sessionId=${payload.sessionId}`);
      // Additional validation can be added here if needed
      return payload;
    } catch (error) {
      this.logger.error('JWT payload validation failed', error instanceof Error ? error.stack : String(error));
      throw new UnauthorizedException('Invalid token payload');
    }
  }
}
