import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUserId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    // Try to get from API key validation (if available)
    // Otherwise return a system identifier
    return request?.user?.apiKeyOwner || request?.user?.sub || 'system';
  },
);
