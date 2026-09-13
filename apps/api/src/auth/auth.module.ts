import { Module, Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import type { StringValue } from 'ms';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { OtpService } from './otp/otp.service.js';
import { JwtTokenService } from './jwt/jwt-token.service.js';
import { JwtStrategy } from './jwt/jwt.strategy.js';
import { AfroMessageOtpProvider, OTP_PROVIDER } from './otp/otp.providers.js';

/** Factory that provides the OTP delivery provider */
const otpProviderFactory: Provider = {
  provide: OTP_PROVIDER,
  inject: [ConfigService],
  useFactory: (config: ConfigService) => new AfroMessageOtpProvider(config),
};

/** Auth module — wires OTP, JWT token, and auth services */
@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: config.get<string>('JWT_EXPIRES_IN', '15m') as StringValue,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, OtpService, JwtTokenService, JwtStrategy, otpProviderFactory],
})
export class AuthModule {}
