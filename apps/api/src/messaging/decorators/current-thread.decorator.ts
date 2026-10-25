import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { ThreadModel } from '../../generated/prisma/models/Thread.js';

/**
 * Returns the thread loaded and authorized by {@link ThreadParticipantGuard}.
 * Only usable on routes protected by that guard; returns undefined otherwise.
 */
export const CurrentThread = createParamDecorator(
  (data: keyof ThreadModel | undefined, ctx: ExecutionContext): ThreadModel | ThreadModel[keyof ThreadModel] | undefined => {
    const request = ctx.switchToHttp().getRequest();
    const thread = request.thread as ThreadModel | undefined;

    if (!thread) {
      return undefined;
    }

    return data ? thread[data] : thread;
  },
);