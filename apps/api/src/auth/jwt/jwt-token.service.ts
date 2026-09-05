import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

/** Shape of the JWT access token payload */
export interface TokenPayload {
  sub: string;
  phone: string;
  sessionId: string;
}

/** Pair of tokens returned after successful authentication */
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

/** Owns JWT generation, refresh token hashing, and verification */
@Injectable()
export class JwtTokenService {
  private readonly logger = new Logger(JwtTokenService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly jwtService: JwtService,
  ) {}

  /** Signs and returns only the access JWT — refresh token is managed separately by AuthService */
  async generateAccessToken(userId: string, phone: string, sessionId: string): Promise<string> {
    const payload: TokenPayload = { sub: userId, phone, sessionId };
    const accessToken = await this.jwtService.signAsync(payload);
    this.logger.log(`Access token generated for user=${userId} session=${sessionId}`);
    return accessToken;
  }

  /** Verifies a JWT access token and returns its payload; throws UnauthorizedException on failure */
  async verifyAccessToken(token: string): Promise<TokenPayload> {
    try {
      return await this.jwtService.verifyAsync<TokenPayload>(token);
    } catch (error) {
      this.logger.error('Access token verification failed', error instanceof Error ? error.stack : String(error));
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  /** Hashes a refresh token with a random salt using scrypt */
  hashRefreshToken(token: string): string {
    const salt = randomBytes(16).toString('hex');
    const hash = scryptSync(token, salt, 64).toString('hex');
    return `${salt}:${hash}`;
  }

  /** Verifies a raw refresh token against its stored hash using constant-time comparison */
  verifyRefreshTokenHash(token: string, storedHash: string): boolean {
    try {
      const [salt, hash] = storedHash.split(':');
      if (!salt || !hash) return false;
      const computed = scryptSync(token, salt, 64);
      const stored = Buffer.from(hash, 'hex');
      if (computed.length !== stored.length) return false;
      return timingSafeEqual(computed, stored);
    } catch (error) {
      this.logger.error('Refresh token hash verification failed', error instanceof Error ? error.stack : String(error));
      return false;
    }
  }

  /** Generates a cryptographically random refresh token */
  generateRefreshToken(): string {
    return randomBytes(32).toString('hex');
  }

  /** Returns the expiry Date for a refresh token based on config */
  getRefreshTokenExpiry(): Date {
    const days = this.config.get<number>('REFRESH_TOKEN_EXPIRY_DAYS', 7);
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }
}
