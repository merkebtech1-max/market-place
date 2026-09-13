import { Logger, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Guard that protects routes by requiring a valid JWT Bearer token.
 * Uses the 'jwt' strategy defined in JwtStrategy.
 * Attaches the validated payload (sub, phone, sessionId) to req.user.
 */
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(JwtAuthGuard.name);

  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const path = request.url;

    if (err || !user) {
      this.logger.warn(`JWT authentication failed for path=${path} error=${err?.message || info?.message || 'Unknown error'}`);
      throw err || new UnauthorizedException('Authentication failed');
    }

    this.logger.log(`JWT authentication successful for path=${path} userId=${user.sub}`);
    return user;
  }
}
