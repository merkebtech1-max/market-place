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
    this.logger.log(`[START] Login attempt for phone=${phone}`);

    try {
      this.logger.debug(`[VALIDATION] Verifying OTP for phone=${phone}`);
      await this.otpService.verifyAndConsumeOtp(phone, code);

      this.logger.debug(`[QUERY] Fetching user by phone=${phone}`);
      const user = await this.prisma.user.findUnique({ where: { phone } });
      if (!user) {
        this.logger.warn(`[AUTH] User not found for phone=${phone}`);
        throw new NotFoundException('No account found for this number. Please register first.');
      }

      this.logger.debug(`[SESSION] Creating session for userId=${user.id}`);
      const { session, refreshToken } = await this.createSession(user.id, userAgent, ipHash);

      this.logger.debug(`[TOKEN] Generating access token for userId=${user.id}, sessionId=${session.id}`);
      const accessToken = await this.jwtTokenService.generateAccessToken(user.id, user.phone, session.id);

      this.logger.log(`[SUCCESS] Login successful: userId=${user.id}, phone=${phone}, sessionId=${session.id}`);
      return { userId: user.id, tokens: { accessToken, refreshToken } };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof UnauthorizedException) {
        throw error;
      }
      this.logger.error(`[ERROR] Login failed for phone=${phone} - ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error.stack : String(error));
      throw new InternalServerErrorException('Unable to complete login at this time. Please try again later.');
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
    this.logger.log(`[START] Registration attempt for phone=${phone}, displayName="${displayName}"`);

    try {
      this.logger.debug(`[VALIDATION] Checking if user already exists for phone=${phone}`);
      const existing = await this.prisma.user.findUnique({ where: { phone } });
      if (existing) {
        this.logger.warn(`[AUTH] User already exists for phone=${phone}, userId=${existing.id}`);
        throw new ConflictException('An account with this phone number already exists. Please log in instead.');
      }

      this.logger.debug(`[VALIDATION] Verifying OTP for phone=${phone}`);
      await this.otpService.verifyAndConsumeOtp(phone, code);

      this.logger.debug(`[QUERY] Creating new user in database`);
      let user: UserModel;
      try {
        user = await this.prisma.user.create({
          data: { phone, displayName, bio, cityId, subcityId, phoneVerifiedAt: new Date() },
        });
      } catch (error: any) {
        // P2002 = Prisma unique constraint violation
        if (error?.code === 'P2002') {
          this.logger.warn(`[AUTH] Duplicate phone constraint violation: phone=${phone}`);
          throw new ConflictException('An account with this phone number already exists. Please log in instead.');
        }
        this.logger.error(`[ERROR] Failed to create user for phone=${phone} - ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error.stack : String(error));
        throw new InternalServerErrorException('Unable to create your account at this time. Please try again later.');
      }

      this.logger.log(`[USER] User created successfully: userId=${user.id}, phone=${phone}`);

      this.logger.debug(`[SESSION] Creating session for userId=${user.id}`);
      const { session, refreshToken } = await this.createSession(user.id, userAgent, ipHash);

      this.logger.debug(`[TOKEN] Generating access token for userId=${user.id}, sessionId=${session.id}`);
      const accessToken = await this.jwtTokenService.generateAccessToken(user.id, user.phone, session.id);

      this.logger.log(`[SUCCESS] Registration successful: userId=${user.id}, phone=${phone}, sessionId=${session.id}`);
      return { userId: user.id, tokens: { accessToken, refreshToken } };
    } catch (error) {
      if (error instanceof ConflictException || error instanceof UnauthorizedException) {
        throw error;
      }
      this.logger.error(`[ERROR] Registration failed for phone=${phone} - ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error.stack : String(error));
      throw new InternalServerErrorException('Unable to complete registration at this time. Please try again later.');
    }
  }

  /**
   * Revokes a session by sessionId.
   * Once the JWT guard is in place, sessionId will come from the verified token payload,
   * not from the request body.
   */
  async logout(sessionId: string): Promise<void> {
    this.logger.log(`[START] Logout attempt for sessionId=${sessionId}`);

    try {
      this.logger.debug(`[QUERY] Revoking session in database: sessionId=${sessionId}`);
      await this.prisma.session.update({
        where: { id: sessionId },
        data: { revokedAt: new Date() },
      });
      this.logger.log(`[SUCCESS] Session revoked: sessionId=${sessionId}`);
    } catch (error: any) {
      // P2025 = Prisma record not found error
      if (error?.code === 'P2025') {
        this.logger.warn(`[NOT_FOUND] Session not found for logout: sessionId=${sessionId}`);
        return;
      }
      this.logger.error(`[ERROR] Failed to revoke session=${sessionId} - ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error.stack : String(error));
      throw new InternalServerErrorException('Unable to complete logout at this time. Please try again later.');
    }
  }

  /**
   * Refreshes an access token using a valid refresh token.
   * Extracts sessionId from the token, finds the session by ID, validates it's not revoked/expired,
   * verifies the token hash, and issues new tokens with rotation.
   */
  async refreshTokens(refreshToken: string): Promise<AuthResult> {
    this.logger.log(`[START] Token refresh attempt`);

    try {
      this.logger.debug(`[TOKEN] Extracting sessionId from refresh token`);
      const sessionId = this.jwtTokenService.extractSessionIdFromRefreshToken(refreshToken);
      if (!sessionId) {
        this.logger.warn(`[VALIDATION] Refresh token does not contain sessionId`);
        throw new UnauthorizedException('Invalid refresh token format');
      }

      this.logger.debug(`[QUERY] Fetching session: sessionId=${sessionId}`);
      const session = await this.prisma.session.findUnique({
        where: { id: sessionId },
      });

      if (!session) {
        this.logger.warn(`[AUTH] Session not found: sessionId=${sessionId}`);
        throw new UnauthorizedException('Invalid refresh token');
      }

      if (session.revokedAt) {
        this.logger.warn(`[AUTH] Attempted to use revoked session: sessionId=${sessionId}, revokedAt=${session.revokedAt.toISOString()}`);
        throw new UnauthorizedException('Session has been revoked');
      }

      if (session.expiresAt < new Date()) {
        this.logger.warn(`[AUTH] Attempted to use expired session: sessionId=${sessionId}, expiresAt=${session.expiresAt.toISOString()}`);
        throw new UnauthorizedException('Refresh token has expired');
      }

      this.logger.debug(`[VALIDATION] Verifying refresh token hash`);
      const randomPart = this.jwtTokenService.getRefreshTokenRandomPart(refreshToken);
      const isValid = this.jwtTokenService.verifyRefreshTokenHash(randomPart, session.refreshTokenHash);
      if (!isValid) {
        this.logger.warn(`[AUTH] Invalid refresh token hash: sessionId=${sessionId}`);
        throw new UnauthorizedException('Invalid refresh token');
      }

      this.logger.debug(`[QUERY] Fetching user for session: userId=${session.userId}`);
      const user = await this.prisma.user.findUnique({ where: { id: session.userId } });
      if (!user) {
        this.logger.error(`[ERROR] User not found for session: sessionId=${sessionId}, userId=${session.userId}`);
        throw new InternalServerErrorException('User not found');
      }

      this.logger.debug(`[TOKEN] Generating new refresh token with rotation: sessionId=${sessionId}`);
      const newRefreshToken = this.jwtTokenService.generateRefreshToken(session.id);
      const newRefreshTokenHash = this.jwtTokenService.hashRefreshTokenRandomPart(newRefreshToken);
      const newExpiresAt = this.jwtTokenService.getRefreshTokenExpiry();

      this.logger.debug(`[QUERY] Updating session with new refresh token: sessionId=${sessionId}`);
      await this.prisma.session.update({
        where: { id: session.id },
        data: { refreshTokenHash: newRefreshTokenHash, expiresAt: newExpiresAt },
      });

      this.logger.debug(`[TOKEN] Generating new access token: userId=${user.id}, sessionId=${sessionId}`);
      const accessToken = await this.jwtTokenService.generateAccessToken(user.id, user.phone, session.id);

      this.logger.log(`[SUCCESS] Tokens refreshed: userId=${user.id}, sessionId=${sessionId}, newExpiresAt=${newExpiresAt.toISOString()}`);
      return { userId: user.id, tokens: { accessToken, refreshToken: newRefreshToken } };
    } catch (error) {
      if (error instanceof UnauthorizedException || error instanceof InternalServerErrorException) {
        throw error;
      }
      this.logger.error(`[ERROR] Token refresh failed - ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error.stack : String(error));
      throw new InternalServerErrorException('Unable to refresh your tokens at this time. Please try again later.');
    }
  }

  /** Creates a session row with a hashed refresh token and returns both the session and raw token */
  private async createSession(userId: string, userAgent?: string, ipHash?: string) {
    this.logger.debug(`[SESSION] Creating session for userId=${userId}`);

    try {
      this.logger.debug(`[TOKEN] Generating sessionId and refresh token`);
      const sessionId = randomUUID();
      const refreshToken = this.jwtTokenService.generateRefreshToken(sessionId);
      const refreshTokenHash = this.jwtTokenService.hashRefreshTokenRandomPart(refreshToken);

      this.logger.debug(`[QUERY] Creating session in database: sessionId=${sessionId}, userId=${userId}`);
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

      this.logger.log(`[SUCCESS] Session created: sessionId=${session.id}, userId=${userId}, expiresAt=${session.expiresAt.toISOString()}`);
      return { session, refreshToken };
    } catch (error) {
      this.logger.error(`[ERROR] Failed to create session for userId=${userId} - ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error.stack : String(error));
      throw new InternalServerErrorException('Unable to create session at this time. Please try again later.');
    }
  }
}
