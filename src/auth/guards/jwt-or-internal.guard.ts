import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from './jwt-auth.guard';
import { InternalApiGuard } from './internal-api.guard';

@Injectable()
export class JwtOrInternalGuard implements CanActivate {
  constructor(
    private jwtAuthGuard: JwtAuthGuard,
    private internalApiGuard: InternalApiGuard,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    // Check if internal API key is present
    const hasInternalApiKey =
      request.headers['x-api-key'] ||
      request.headers['x-internal-api-key'] ||
      request.headers['internal-api-key'];

    if (hasInternalApiKey) {
      // Try internal API key authentication
      try {
        return this.internalApiGuard.canActivate(context);
      } catch {
        // If internal API key fails, fall back to JWT
      }
    }

    // Try JWT authentication
    const result = await this.jwtAuthGuard.canActivate(context);
    return result as boolean;
  }
}
