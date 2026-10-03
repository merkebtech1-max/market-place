import { UserStatus } from '../../generated/prisma/enums.js';

/** Shown to users whose account has been permanently disabled. */
export const BANNED_ACCOUNT_MESSAGE =
  'This account has been banned and can no longer sign in. If you believe this was a mistake, please contact support.';

export function isBannedStatus(status: UserStatus): boolean {
  return status === UserStatus.DELETED;
}