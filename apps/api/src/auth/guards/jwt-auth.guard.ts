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
      const errorMessage = err?.message || info?.message || 'No authentication token provided';
      this.logger.warn(`[AUTH] JWT authentication failed for path=${path} - ${errorMessage}`);
      
      // Provide user-friendly error message
      if (errorMessage.includes('No auth token')) {
        throw new UnauthorizedException('Authentication required. Please provide a valid Bearer token in the Authorization header.');
      }
      if (errorMessage.includes('expired')) {
        throw new UnauthorizedException('Your session has expired. Please log in again.');
      }
      if (errorMessage.includes('invalid')) {
        throw new UnauthorizedException('Invalid authentication token. Please log in again.');
      }
      
      throw err || new UnauthorizedException('Authentication failed. Please log in to access this resource.');
    }

    this.logger.log(`[AUTH] JWT authentication successful for path=${path} userId=${user.sub}`);
    return user;
  }
}
