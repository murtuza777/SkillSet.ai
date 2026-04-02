import { hashValue } from './crypto';

import type { AppBindings } from '../types';

const getWindow = (env: AppBindings) => Number.parseInt(env.RATE_LIMIT_WINDOW_SECONDS, 10) || 60;

export const applyRateLimit = async (
  env: AppBindings,
  bucket: string,
  identifier: string,
  limit: number,
) => {
  const windowSeconds = getWindow(env);
  const windowBucket = Math.floor(Date.now() / 1000 / windowSeconds);
  const hashedIdentifier = await hashValue(`${bucket}:${identifier}`);
  const key = `rate_limit:${bucket}:${windowBucket}:${hashedIdentifier}`;
  const current = Number.parseInt((await env.CACHE.get(key)) ?? '0', 10) || 0;

  if (current >= limit) {
    return {
      allowed: false,
      retryAfter: windowSeconds,
    };
  }

  await env.CACHE.put(key, String(current + 1), {
    expirationTtl: windowSeconds,
  });

  return {
    allowed: true,
    retryAfter: windowSeconds,
  };
};
