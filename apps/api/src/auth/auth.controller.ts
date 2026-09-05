import { Body, Controller, Headers, Post } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { OtpService } from './otp/otp.service.js';
import { RequestOtpDto } from './otp/dto/request-otp.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { hashIp } from './common/ip-hash.util.js';

/** Handles HTTP routes for authentication: OTP request, register, login, and logout */
@Controller('auth')
export class AuthController {
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
    await this.otpService.requestOtp(dto.phone, hashIp(cfIp, xff));
    return { success: true, message: 'OTP sent successfully' };
  }

  /** Registers a new user with a full profile; requires a valid OTP */
  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Headers('user-agent') userAgent?: string,
    @Headers('cf-connecting-ip') cfIp?: string,
    @Headers('x-forwarded-for') xff?: string,
  ) {
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
    return {
      success: true,
      message: 'Account created successfully',
      userId: result.userId,
      tokens: result.tokens,
    };
  }

  /** Verifies OTP and returns tokens for an existing user */
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Headers('user-agent') userAgent?: string,
    @Headers('cf-connecting-ip') cfIp?: string,
    @Headers('x-forwarded-for') xff?: string,
  ) {
    const result = await this.authService.login(
      dto.phone,
      dto.code,
      userAgent,
      hashIp(cfIp, xff),
    );
    return {
      success: true,
      message: 'Logged in successfully',
      userId: result.userId,
      tokens: result.tokens,
    };
  }

  /**
   * Logs out the current session.
   * TODO: once JwtAuthGuard is in place, sessionId will be extracted from
   * the verified JWT payload (req.user.sessionId) instead of the request body.
   */
  @Post('logout')
  async logout(@Body('sessionId') sessionId: string) {
    await this.authService.logout(sessionId);
    return { success: true, message: 'Logged out successfully' };
  }
}
