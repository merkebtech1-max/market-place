import {
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes, randomInt, scryptSync, timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service.js';
import { OTP_PROVIDER, OtpProvider } from './otp.providers.js';

/** Owns the full OTP lifecycle: generate, store, send, verify, consume */
@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Inject(OTP_PROVIDER) private readonly otpProvider: OtpProvider,
  ) {}

  /** Generates, stores, and sends an OTP to the given phone number */
  async requestOtp(phone: string, ipHash?: string): Promise<void> {
    await this.enforceRateLimit(phone, ipHash);

    const code = this.generateCode();
    const codeHash = this.hashCode(code);
    const expiresAt = this.expiryDate();

    try {
      // Send first — only persist to DB if delivery succeeds
      await this.otpProvider.send({
        to: phone,
        message: `Your Merkeb Market code is ${code}. Expires in ${this.expirySeconds() / 60} minutes.`,
      });

      await this.prisma.otpRequest.create({
        data: { phone, codeHash, ipHash, expiresAt },
      });

      this.logger.log(`OTP sent and stored for phone=${phone}`);
    } catch (error) {
      this.logger.error(`Failed to send OTP to phone=${phone}`, error instanceof Error ? error.stack : String(error));
      throw new InternalServerErrorException('Failed to send OTP. Please try again later.');
    }
  }

  /**
   * Verifies the OTP code for a phone number.
   * Throws UnauthorizedException if invalid or expired.
   */
  async verifyAndConsumeOtp(phone: string, code: string): Promise<void> {
    const otpRequest = await this.prisma.otpRequest.findFirst({
      where: { phone, consumedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpRequest || !this.verifyCodeHash(code, otpRequest.codeHash)) {
      this.logger.warn(`Invalid or expired OTP for phone=${phone}`);
      throw new UnauthorizedException('Invalid or expired OTP');
    }

    await this.prisma.otpRequest.update({
      where: { id: otpRequest.id },
      data: { consumedAt: new Date() },
    });

    this.logger.log(`OTP verified and consumed for phone=${phone}`);
  }

  /** Generates a random numeric OTP code of configured length */
  private generateCode(): string {
    const length = this.config.get<number>('OTP_LENGTH', 6);
    const min = 10 ** (length - 1);
    const max = 10 ** length - 1;
    return randomInt(min, max+1).toString();
  }

  /** Hashes an OTP code with a random salt using scrypt */
  private hashCode(code: string): string {
    const salt = randomBytes(16).toString('hex');
    const derived = scryptSync(code, salt, 64);
    return `${salt}:${derived.toString('hex')}`;
  }

  /** Verifies a raw OTP code against its stored hash using constant-time comparison */
  private verifyCodeHash(code: string, codeHash: string): boolean {
    try {
      const [salt, hash] = codeHash.split(':');
      if (!salt || !hash) return false;
      const computed = scryptSync(code, salt, 64);
      const stored = Buffer.from(hash, 'hex');
      if (computed.length !== stored.length) return false;
      return timingSafeEqual(computed, stored);
    } catch {
      return false;
    }
  }

  /** Returns the configured OTP expiry duration in seconds */
  private expirySeconds(): number {
    return this.config.get<number>('OTP_EXPIRY_SECONDS', 300);
  }

  /** Returns the absolute expiry Date for a new OTP */
  private expiryDate(): Date {
    return new Date(Date.now() + this.expirySeconds() * 1000);
  }

  /** Throws ConflictException if rate limits are exceeded for this phone or IP */
  private async enforceRateLimit(phone: string, ipHash?: string): Promise<void> {
    // Per-phone: block if there is already an unconsumed, unexpired OTP
    const phoneBlock = await this.prisma.otpRequest.findFirst({
      where: { phone, consumedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    if (phoneBlock) {
      const wait = Math.ceil((phoneBlock.expiresAt.getTime() - Date.now()) / 1000);
      throw new ConflictException(`OTP already sent. Wait ${wait}s before requesting a new one.`);
    }

    // Per-IP: count requests in the current window — allows multiple users
    // behind the same NAT to each get an OTP, but caps abuse at a threshold.
    if (ipHash) {
      const windowStart = new Date(Date.now() - this.expirySeconds() * 1000);
      const ipCount = await this.prisma.otpRequest.count({
        where: { ipHash, createdAt: { gt: windowStart } },
      });
      const limit = this.config.get<number>('OTP_IP_RATE_LIMIT', 5);
      if (ipCount >= limit) {
        throw new ConflictException('Too many OTP requests from this network. Please try again later.');
      }
    }
  }
}
