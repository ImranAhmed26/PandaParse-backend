import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class InternalApiGuard implements CanActivate {
  constructor(private configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const apiKey = this.extractApiKeyFromHeader(request);

    if (!apiKey) {
      console.error('❌ Missing API key in request headers:', request.headers);
      throw new UnauthorizedException('Internal API key is required');
    }

    const validApiKey = this.configService.get<string>('INTERNAL_API_KEY');

    if (!validApiKey) {
      console.error('❌ No INTERNAL_API_KEY configured in backend env');
      throw new UnauthorizedException('Internal API key not configured');
    }

    if (apiKey !== validApiKey) {
      console.error(`❌ Invalid API key - Received: "${apiKey}", Expected: "${validApiKey}"`);
      throw new UnauthorizedException('Invalid internal API key');
    }

    return true;
  }

  private extractApiKeyFromHeader(request: Request): string | undefined {
    // Check for API key in multiple possible headers
    const apiKey =
      request.headers['x-api-key'] ||
      request.headers['x-internal-api-key'] ||
      request.headers['internal-api-key'];

    return Array.isArray(apiKey) ? apiKey[0] : apiKey;
  }
}
