import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRequire } from 'node:module';
import type { SmsApiConfig, SendSmsGetRequest } from 'afromessage/dist/src/types/index.types.js';

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-require-imports
const AfromessageCtor = require('afromessage').default as {
  getInstance(config: SmsApiConfig): { sendSms(payload: SendSmsGetRequest): Promise<unknown> };
};

export interface SendOtpParams {
  to: string;
  message: string;
}

/** Provider contract — only responsible for delivering OTPs, not verifying them */
export abstract class OtpProvider {
  abstract send(params: SendOtpParams): Promise<void>;
}

export const OTP_PROVIDER = Symbol('OTP_PROVIDER');

@Injectable()
export class AfroMessageOtpProvider implements OtpProvider {
  private readonly logger = new Logger(AfroMessageOtpProvider.name);
  private readonly smsApi: { sendSms(payload: SendSmsGetRequest): Promise<unknown> };

  constructor(config: ConfigService) {
    const apiKey = config.getOrThrow<string>('AFROMESSAGE_TOKEN');
    const identifierId = config.getOrThrow<string>('AFROMESSAGE_IDENTIFIER_ID');
    const senderName = config.getOrThrow<string>('AFROMESSAGE_SENDER_NAMES');

    this.smsApi = AfromessageCtor.getInstance({
      apiKey,
      identifierId,
      senderName,
    });
  }

  async send({ to, message }: SendOtpParams): Promise<void> {
    try {
      const response = await this.smsApi.sendSms({
        to,
        message,
      });
      this.logger.log(
        `[AFROMESSAGE OTP] OTP sent successfully to=${to} response=${JSON.stringify(response)}`,
      );
    } catch (error) {
      this.logger.error(
        `[AFROMESSAGE OTP] Failed to send OTP to=${to} error=${error instanceof Error ? error.message : String(error)}`,
      );
      throw new Error(`Failed to send OTP: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

}
