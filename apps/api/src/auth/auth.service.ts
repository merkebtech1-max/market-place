import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
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
    await this.otpService.verifyAndConsumeOtp(phone, code);

    const user = await this.prisma.user.findUnique({ where: { phone } });
    if (!user) {
      throw new NotFoundException('No account found for this number. Please register first.');
    }

    const { session, refreshToken } = await this.createSession(user.id, userAgent, ipHash);
    const accessToken = await this.jwtTokenService.generateAccessToken(user.id, user.phone, session.id);

    this.logger.log(`Login successful user=${user.id} session=${session.id}`);
    return { userId: user.id, tokens: { accessToken, refreshToken } };
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
    const existing = await this.prisma.user.findUnique({ where: { phone } });
    if (existing) {
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
      this.logger.error(`Failed to create user for phone=${phone}`, error.stack);
      throw new InternalServerErrorException('Registration failed. Please try again.');
    }

    this.logger.log(`User registered user=${user.id}`);

    const { session, refreshToken } = await this.createSession(user.id, userAgent, ipHash);
    const accessToken = await this.jwtTokenService.generateAccessToken(user.id, user.phone, session.id);

    return { userId: user.id, tokens: { accessToken, refreshToken } };
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
    } catch (error) {
      this.logger.error(`Failed to revoke session=${sessionId}`, error instanceof Error ? error.stack : String(error));
      throw new InternalServerErrorException('Failed to logout. Please try again later.');
    }
  }

  /** Creates a session row with a hashed refresh token and returns both the session and raw token */
  private async createSession(userId: string, userAgent?: string, ipHash?: string) {
    const refreshToken = this.jwtTokenService.generateRefreshToken();
    const refreshTokenHash = this.jwtTokenService.hashRefreshToken(refreshToken);
    const expiresAt = this.jwtTokenService.getRefreshTokenExpiry();

    const session = await this.prisma.session.create({
      data: { userId, refreshTokenHash, userAgent, ipHash, expiresAt },
    });

    this.logger.log(`Session created session=${session.id} user=${userId}`);
    return { session, refreshToken };
  }
}
