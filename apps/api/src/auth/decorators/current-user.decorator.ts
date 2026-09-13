import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { TokenPayload } from '../jwt/jwt-token.service.js';

/**
 * Custom decorator to extract the authenticated user from the request.
 * Returns the JWT payload (sub, phone, sessionId) attached by JwtAuthGuard.
 *
 * Usage in controllers:
 * @UseGuards(JwtAuthGuard)
 * async someMethod(@CurrentUser() user: TokenPayload) {
 *   console.log(user.sub, user.phone, user.sessionId);
 * }
 */
export const CurrentUser = createParamDecorator(
  (data: keyof TokenPayload | undefined, ctx: ExecutionContext): TokenPayload | string => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as TokenPayload;

    if (!user) {
      throw new Error('No user found in request - make sure JwtAuthGuard is applied');
    }

    // If a specific field is requested (e.g., @CurrentUser('sub')), return just that field
    // Otherwise return the entire user object
    return data ? user[data] : user;
  },
);
