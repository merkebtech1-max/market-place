import { Body, Controller, Headers, Logger, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service.js';
import { OtpService } from './otp/otp.service.js';
import { RequestOtpDto } from './otp/dto/request-otp.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { RefreshDto } from './dto/refresh.dto.js';
import { hashIp } from './common/ip-hash.util.js';
import { CurrentUser } from './decorators/current-user.decorator.js';
import type { TokenPayload } from './jwt/jwt-token.service.js';

/** Handles HTTP routes for authentication: OTP request, register, login, and logout */
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly otpService: OtpService,
  ) {}

  /** Sends an OTP to the provided phone number */
  @Post('otp/request')
  async requestOtp(
    @Body() dto: RequestOtpDto,
    @Headers('cf-connecting-ip') cfIp?: string,
    @Headers('x-forwarded-for') xff?: string,
  ) {
    try {
      this.logger.log(`OTP request initiated for phone=${dto.phone}`);
      await this.otpService.requestOtp(dto.phone, hashIp(cfIp, xff));
      this.logger.log(`OTP sent successfully for phone=${dto.phone}`);
      return { success: true, message: 'OTP sent successfully' };
    } catch (error) {
      this.logger.error(`OTP request failed for phone=${dto.phone}`, error instanceof Error ? error.stack : String(error));
      throw error;
    }
  }

  /** Registers a new user with a full profile; requires a valid OTP */
  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Headers('user-agent') userAgent?: string,
    @Headers('cf-connecting-ip') cfIp?: string,
    @Headers('x-forwarded-for') xff?: string,
  ) {
    try {
      this.logger.log(`Registration attempt for phone=${dto.phone} displayName=${dto.displayName}`);
      const result = await this.authService.register(
        dto.phone,
        dto.code,
        dto.displayName,
        dto.bio,
        dto.cityId,
        dto.subcityId,
        userAgent,
        hashIp(cfIp, xff),
      );
      this.logger.log(`Registration successful for userId=${result.userId}`);
      return {
        success: true,
        message: 'Account created successfully',
        userId: result.userId,
        tokens: result.tokens,
      };
    } catch (error) {
      this.logger.error(`Registration failed for phone=${dto.phone}`, error instanceof Error ? error.stack : String(error));
      throw error;
    }
  }

  /** Verifies OTP and returns tokens for an existing user */
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Headers('user-agent') userAgent?: string,
    @Headers('cf-connecting-ip') cfIp?: string,
    @Headers('x-forwarded-for') xff?: string,
  ) {
    try {
      this.logger.log(`Login attempt for phone=${dto.phone}`);
      const result = await this.authService.login(
        dto.phone,
        dto.code,
        userAgent,
        hashIp(cfIp, xff),
      );
      this.logger.log(`Login successful for userId=${result.userId}`);
      return {
        success: true,
        message: 'Logged in successfully',
        userId: result.userId,
        tokens: result.tokens,
      };
    } catch (error) {
      this.logger.error(`Login failed for phone=${dto.phone}`, error instanceof Error ? error.stack : String(error));
      throw error;
    }
  }

  /**
   * Logs out the current session.
   * Requires a valid JWT. SessionId is extracted from the verified JWT payload.
   */
  @Post('logout')
  @UseGuards(AuthGuard('jwt'))
  async logout(@CurrentUser() user: TokenPayload) {
    try {
      this.logger.log(`Logout attempt for userId=${user.sub} sessionId=${user.sessionId}`);
      await this.authService.logout(user.sessionId);
      this.logger.log(`Logout successful for userId=${user.sub} sessionId=${user.sessionId}`);
      return { success: true, message: 'Logged out successfully' };
    } catch (error) {
      this.logger.error(`Logout failed for userId=${user.sub} sessionId=${user.sessionId}`, error instanceof Error ? error.stack : String(error));
      throw error;
    }
  }

  /** Refreshes access token using a valid refresh token */
  @Post('refresh')
  async refresh(@Body() dto: RefreshDto) {
    try {
      this.logger.log('Token refresh attempt');
      const result = await this.authService.refreshTokens(dto.refreshToken);
      this.logger.log(`Token refresh successful for userId=${result.userId}`);
      return {
        success: true,
        message: 'Tokens refreshed successfully',
        userId: result.userId,
        tokens: result.tokens,
      };
    } catch (error) {
      this.logger.error('Token refresh failed', error instanceof Error ? error.stack : String(error));
      throw error;
    }
  }
}
