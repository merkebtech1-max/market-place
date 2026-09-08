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
    try {
      const payload: TokenPayload = { sub: userId, phone, sessionId };
      const accessToken = await this.jwtService.signAsync(payload);
      this.logger.log(`Access token generated for user=${userId} session=${sessionId}`);
      return accessToken;
    } catch (error) {
      this.logger.error(`Failed to generate access token for user=${userId} session=${sessionId}`, error instanceof Error ? error.stack : String(error));
      throw new Error('Failed to generate access token');
    }
  }

  /** Hashes a refresh token with a random salt using scrypt */
  hashRefreshToken(token: string): string {
    const salt = randomBytes(16).toString('hex');
    const hash = scryptSync(token, salt, 64).toString('hex');
    return `${salt}:${hash}`;
  }

  /** Extracts sessionId and random part from a refresh token */
  private parseRefreshToken(refreshToken: string): { sessionId: string | undefined; randomPart: string } {
    const sessionId = this.extractSessionIdFromRefreshToken(refreshToken);
    const randomPart = sessionId ? refreshToken.substring(sessionId.length + 1) : refreshToken;
    return { sessionId, randomPart };
  }

  /** Hashes only the random part of a refresh token (excluding sessionId prefix) */
  hashRefreshTokenRandomPart(refreshToken: string): string {
    const { randomPart } = this.parseRefreshToken(refreshToken);
    return this.hashRefreshToken(randomPart);
  }

  /** Returns the random part of a refresh token for verification */
  getRefreshTokenRandomPart(refreshToken: string): string {
    const { randomPart } = this.parseRefreshToken(refreshToken);
    return randomPart;
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

  /** Generates a cryptographically random refresh token with optional sessionId */
  generateRefreshToken(sessionId?: string): string {
    const randomPart = randomBytes(32).toString('hex');
    // Include sessionId to enable session lookup without hash-based search
    return sessionId ? `${sessionId}:${randomPart}` : randomPart;
  }

  /** Extracts sessionId from a refresh token, returns undefined if not found */
  extractSessionIdFromRefreshToken(refreshToken: string): string | undefined {
    const parts = refreshToken.split(':');
    // Format is sessionId:randomPart, so sessionId is the first part
    // If there's no colon, this is an old-format token without sessionId
    return parts.length >= 2 ? parts[0] : undefined;
  }

  /** Returns the expiry Date for a refresh token based on config */
  getRefreshTokenExpiry(): Date {
    const days = this.config.get<number>('REFRESH_TOKEN_EXPIRY_DAYS', 7);
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }
}
