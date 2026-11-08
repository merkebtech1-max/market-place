import { Matches } from 'class-validator';
import { ETHIOPIAN_MOBILE_MESSAGE, ETHIOPIAN_MOBILE_PATTERN } from '../../dto/ethiopian-phone.js';

export class RequestOtpDto {
  @Matches(ETHIOPIAN_MOBILE_PATTERN, { message: ETHIOPIAN_MOBILE_MESSAGE })
  phone: string;
}
