import type { MiddlewareHandler } from 'hono';

import { verifyAccessToken } from '../lib/auth';
import { jsonError } from '../lib/http';
import { applyRateLimit } from '../lib/rate-limit';
import type { AppBindings, AppVariables } from '../types';

type AppMiddleware = MiddlewareHandler<{
  Bindings: AppBindings;
  Variables: AppVariables;
}>;

export const databaseMiddleware: AppMiddleware = async (c, next) => {
  await next();
};

export const requireAuth: AppMiddleware = async (c, next) => {
  const header = c.req.header('authorization');
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return jsonError(c, 401, 'Authentication required');
  }

  try {
    const user = await verifyAccessToken(c.env, token);
    c.set('authUser', user);
    await next();
  } catch {
    return jsonError(c, 401, 'Invalid or expired access token');
  }
};

export const requireRole = (...roles: Array<'user' | 'mentor' | 'admin'>): AppMiddleware => {
  return async (c, next) => {
    const authUser = c.get('authUser');

    if (!authUser) {
      return jsonError(c, 401, 'Authentication required');
    }

    if (!roles.includes(authUser.role)) {
      return jsonError(c, 403, 'Insufficient permissions');
    }

    await next();
  };
};

export const rateLimit = (bucket: string, limitResolver?: (env: AppBindings) => number): AppMiddleware => {
  return async (c, next) => {
    const ipAddress = c.req.header('CF-Connecting-IP') ?? 'unknown';
    const limit = limitResolver
      ? limitResolver(c.env)
      : Number.parseInt(c.env.RATE_LIMIT_MAX_REQUESTS, 10) || 60;

    const result = await applyRateLimit(c.env, bucket, ipAddress, limit);

    if (!result.allowed) {
      return jsonError(c, 429, 'Rate limit exceeded', {
        retryAfter: result.retryAfter,
      });
    }

    await next();
  };
};
