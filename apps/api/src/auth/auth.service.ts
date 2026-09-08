import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { OtpService } from './otp/otp.service.js';
import { JwtTokenService, AuthTokens } from './jwt/jwt-token.service.js';
import { UserModel } from '../generated/prisma/models/User.js';

/** Tokens returned after a successful login or registration */
export interface AuthResult {
  userId: string;
  tokens: AuthTokens;
}

/** Owns the authentication business flow: verify OTP → user lookup/create → session → tokens */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly otpService: OtpService,
    private readonly jwtTokenService: JwtTokenService,
  ) {}

  /**
   * Logs in an existing user.
   * Verifies OTP, looks up the user by phone, creates a session, and returns tokens.
   * Throws NotFoundException if no account exists for the phone — caller should register first.
   */
  async login(phone: string, code: string, userAgent?: string, ipHash?: string): Promise<AuthResult> {
    try {
      this.logger.log(`Login attempt for phone=${phone}`);
      await this.otpService.verifyAndConsumeOtp(phone, code);

      const user = await this.prisma.user.findUnique({ where: { phone } });
      if (!user) {
        this.logger.warn(`User not found for phone=${phone}`);
        throw new NotFoundException('No account found for this number. Please register first.');
      }

      const { session, refreshToken } = await this.createSession(user.id, userAgent, ipHash);
      const accessToken = await this.jwtTokenService.generateAccessToken(user.id, user.phone, session.id);

      this.logger.log(`Login successful user=${user.id} session=${session.id}`);
      return { userId: user.id, tokens: { accessToken, refreshToken } };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof UnauthorizedException) {
        throw error;
      }
      this.logger.error(`Login failed for phone=${phone}`, error instanceof Error ? error.stack : String(error));
      throw new InternalServerErrorException('Login failed. Please try again.');
    }
  }

  /**
   * Registers a new user with a full profile.
   * Verifies OTP, creates the user, creates a session, and returns tokens.
   * Throws ConflictException if the phone is already registered.
   */
  async register(
    phone: string,
    code: string,
    displayName: string,
    bio?: string,
    cityId?: string,
    subcityId?: string,
    userAgent?: string,
    ipHash?: string,
  ): Promise<AuthResult> {
    try {
      this.logger.log(`Registration attempt for phone=${phone} displayName=${displayName}`);
      const existing = await this.prisma.user.findUnique({ where: { phone } });
      if (existing) {
        this.logger.warn(`User already exists for phone=${phone}`);
        throw new ConflictException('An account with this phone number already exists. Please log in instead.');
      }

      await this.otpService.verifyAndConsumeOtp(phone, code);

      let user: UserModel;
      try {
        user = await this.prisma.user.create({
          data: { phone, displayName, bio, cityId, subcityId, phoneVerifiedAt: new Date() },
        });
      } catch (error: any) {
        // P2002 = Prisma unique constraint violation
        if (error?.code === 'P2002') {
          throw new ConflictException('An account with this phone number already exists. Please log in instead.');
        }
        this.logger.error(`Failed to create user for phone=${phone}`, error instanceof Error ? error.stack : String(error));
        throw new InternalServerErrorException('Registration failed. Please try again.');
      }

      this.logger.log(`User registered user=${user.id}`);

      const { session, refreshToken } = await this.createSession(user.id, userAgent, ipHash);
      const accessToken = await this.jwtTokenService.generateAccessToken(user.id, user.phone, session.id);

      return { userId: user.id, tokens: { accessToken, refreshToken } };
    } catch (error) {
      if (error instanceof ConflictException || error instanceof UnauthorizedException) {
        throw error;
      }
      this.logger.error(`Registration failed for phone=${phone}`, error instanceof Error ? error.stack : String(error));
      throw new InternalServerErrorException('Registration failed. Please try again.');
    }
  }

  /**
   * Revokes a session by sessionId.
   * Once the JWT guard is in place, sessionId will come from the verified token payload,
   * not from the request body.
   */
  async logout(sessionId: string): Promise<void> {
    try {
      await this.prisma.session.update({
        where: { id: sessionId },
        data: { revokedAt: new Date() },
      });
      this.logger.log(`Session revoked session=${sessionId}`);
    } catch (error: any) {
      // P2025 = Prisma record not found error
      if (error?.code === 'P2025') {
        this.logger.warn(`Session not found for logout sessionId=${sessionId}`);
        return;
      }
      this.logger.error(`Failed to revoke session=${sessionId}`, error instanceof Error ? error.stack : String(error));
      throw new InternalServerErrorException('Failed to logout. Please try again later.');
    }
  }

  /**
   * Refreshes an access token using a valid refresh token.
   * Extracts sessionId from the token, finds the session by ID, validates it's not revoked/expired,
   * verifies the token hash, and issues new tokens with rotation.
   */
  async refreshTokens(refreshToken: string): Promise<AuthResult> {
    try {
      this.logger.log('Token refresh attempt');

      // Extract sessionId from refresh token
      const sessionId = this.jwtTokenService.extractSessionIdFromRefreshToken(refreshToken);
      if (!sessionId) {
        this.logger.warn('Refresh token does not contain sessionId');
        throw new UnauthorizedException('Invalid refresh token format');
      }

      // Find session by sessionId
      const session = await this.prisma.session.findUnique({
        where: { id: sessionId },
      });

      if (!session) {
        this.logger.warn(`Session not found for sessionId=${sessionId}`);
        throw new UnauthorizedException('Invalid refresh token');
      }

      if (session.revokedAt) {
        this.logger.warn(`Attempted to use revoked session=${session.id}`);
        throw new UnauthorizedException('Session has been revoked');
      }

      if (session.expiresAt < new Date()) {
        this.logger.warn(`Attempted to use expired session=${session.id}`);
        throw new UnauthorizedException('Refresh token has expired');
      }

      // Verify the hash of the random part
      const randomPart = this.jwtTokenService.getRefreshTokenRandomPart(refreshToken);
      const isValid = this.jwtTokenService.verifyRefreshTokenHash(randomPart, session.refreshTokenHash);
      if (!isValid) {
        this.logger.warn(`Invalid refresh token hash for session=${session.id}`);
        throw new UnauthorizedException('Invalid refresh token');
      }

      const user = await this.prisma.user.findUnique({ where: { id: session.userId } });
      if (!user) {
        this.logger.error(`User not found for session=${session.id}`);
        throw new InternalServerErrorException('User not found');
      }

      // Generate new refresh token with same sessionId (rotation)
      const newRefreshToken = this.jwtTokenService.generateRefreshToken(session.id);
      const newRefreshTokenHash = this.jwtTokenService.hashRefreshTokenRandomPart(newRefreshToken);
      const newExpiresAt = this.jwtTokenService.getRefreshTokenExpiry();

      await this.prisma.session.update({
        where: { id: session.id },
        data: { refreshTokenHash: newRefreshTokenHash, expiresAt: newExpiresAt },
      });

      const accessToken = await this.jwtTokenService.generateAccessToken(user.id, user.phone, session.id);

      this.logger.log(`Tokens refreshed for user=${user.id} session=${session.id}`);
      return { userId: user.id, tokens: { accessToken, refreshToken: newRefreshToken } };
    } catch (error) {
      if (error instanceof UnauthorizedException || error instanceof InternalServerErrorException) {
        throw error;
      }
      this.logger.error('Token refresh failed', error instanceof Error ? error.stack : String(error));
      throw new InternalServerErrorException('Token refresh failed. Please try again.');
    }
  }

  /** Creates a session row with a hashed refresh token and returns both the session and raw token */
  private async createSession(userId: string, userAgent?: string, ipHash?: string) {
    try {
      // Generate UUID manually to avoid chicken-and-egg problem with refresh token
      const sessionId = randomUUID();
      const refreshToken = this.jwtTokenService.generateRefreshToken(sessionId);
      const refreshTokenHash = this.jwtTokenService.hashRefreshTokenRandomPart(refreshToken);

      const session = await this.prisma.session.create({
        data: {
          id: sessionId,
          userId,
          userAgent,
          ipHash,
          refreshTokenHash,
          expiresAt: this.jwtTokenService.getRefreshTokenExpiry(),
        },
      });

      this.logger.log(`Session created session=${session.id} user=${userId}`);
      return { session, refreshToken };
    } catch (error) {
      this.logger.error(`Failed to create session for user=${userId}`, error instanceof Error ? error.stack : String(error));
      throw new InternalServerErrorException('Failed to create session. Please try again.');
    }
  }
}
