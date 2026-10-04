import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { OtpService } from './otp/otp.service.js';
import { JwtTokenService } from './jwt/jwt-token.service.js';

describe('AuthService', () => {
  let service: AuthService;
  const prisma = {
    user: { findUnique: vi.fn() },
  };
  const otpService = { verifyAndConsumeOtp: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: OtpService, useValue: otpService },
        { provide: JwtTokenService, useValue: {} },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('does not consume an OTP when the phone is not registered', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(service.login('+251911111111', '123456')).rejects.toMatchObject({
      status: 404,
    });
    expect(otpService.verifyAndConsumeOtp).not.toHaveBeenCalled();
  });
});
