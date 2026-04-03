import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

import { signAccessToken } from '../lib/auth';
import { hashValue } from '../lib/crypto';
import { jsonError, jsonSuccess } from '../lib/http';
import { requireCurrentUser } from '../lib/session';
import { rateLimit, requireAuth } from '../middleware/auth';
import {
  createEmailVerificationToken,
  createGuestUser,
  createRefreshSession,
  createUser,
  findUserByEmail,
  findUserById,
  getUserWithProfile,
  isGuestSessionValid,
  mapUserRowToAuthUser,
  revokeRefreshToken,
  rotateRefreshSession,
  validateUserPassword,
  verifyEmailToken,
} from '../services/auth-service';
import type { AppBindings, AppVariables } from '../types';

const app = new Hono<{
  Bindings: AppBindings;
  Variables: AppVariables;
}>();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(2),
  timezone: z.string().optional(),
  language: z.string().optional(),
  experienceLevel: z.string().optional(),
  weeklyHours: z.number().int().positive().max(80).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const verifyEmailSchema = z.object({
  email: z.string().email(),
  token: z.string().min(16),
});

const refreshCookieName = 'skillset_refresh';

const setRefreshCookie = (
  c: typeof app extends Hono<infer T> ? import('hono').Context<T> : never,
  token: string,
  ttlSeconds: number,
) => {
  setCookie(c, refreshCookieName, token, {
    httpOnly: true,
    sameSite: c.req.url.startsWith('https://') ? 'None' : 'Lax',
    secure: c.req.url.startsWith('https://'),
    path: '/',
    maxAge: ttlSeconds,
  });
};

app.post(
  '/register',
  rateLimit('auth-register', (env) => Number.parseInt(env.AUTH_RATE_LIMIT_MAX_REQUESTS, 10) || 10),
  zValidator('json', registerSchema),
  async (c) => {
    const payload = c.req.valid('json');
    const existingUser = await findUserByEmail(c.env.DB, payload.email);

    if (existingUser) {
      return jsonError(c, 409, 'Email is already registered');
    }

    const user = await createUser(c.env.DB, payload);

    if (!user) {
      return jsonError(c, 500, 'Unable to create user');
    }

    const verificationToken = await createEmailVerificationToken(c.env, user.id, user.email);

    const authUser = mapUserRowToAuthUser(user);
    const accessToken = await signAccessToken(c.env, authUser);
    const refreshTtl = Number.parseInt(c.env.REFRESH_TOKEN_TTL_SECONDS, 10) || 2592000;
    const refreshSession = await createRefreshSession(c.env.DB, {
      userId: user.id,
      ttlSeconds: refreshTtl,
      ipAddress: c.req.header('CF-Connecting-IP') ?? null,
      userAgent: c.req.header('user-agent') ?? null,
    });

    setRefreshCookie(c, refreshSession.plainToken, refreshTtl);

    return jsonSuccess(
      c,
      {
        accessToken,
        user: authUser,
        verificationToken,
      },
      201,
    );
  },
);

app.post(
  '/login',
  rateLimit('auth-login', (env) => Number.parseInt(env.AUTH_RATE_LIMIT_MAX_REQUESTS, 10) || 10),
  zValidator('json', loginSchema),
  async (c) => {
    const payload = c.req.valid('json');
    const user = await findUserByEmail(c.env.DB, payload.email);

    if (!user) {
      return jsonError(c, 401, 'Invalid email or password');
    }

    const isValidPassword = await validateUserPassword(user, payload.password);

    if (!isValidPassword) {
      return jsonError(c, 401, 'Invalid email or password');
    }

    const authUser = mapUserRowToAuthUser(user);
    const accessToken = await signAccessToken(c.env, authUser);
    const refreshTtl = Number.parseInt(c.env.REFRESH_TOKEN_TTL_SECONDS, 10) || 2592000;
    const refreshSession = await createRefreshSession(c.env.DB, {
      userId: user.id,
      ttlSeconds: refreshTtl,
      ipAddress: c.req.header('CF-Connecting-IP') ?? null,
      userAgent: c.req.header('user-agent') ?? null,
    });

    setRefreshCookie(c, refreshSession.plainToken, refreshTtl);

    return jsonSuccess(c, {
      accessToken,
      user: authUser,
    });
  },
);

app.post(
  '/guest',
  rateLimit('auth-guest', (env) => Number.parseInt(env.AUTH_RATE_LIMIT_MAX_REQUESTS, 10) || 10),
  async (c) => {
    const refreshTtl = Number.parseInt(c.env.REFRESH_TOKEN_TTL_SECONDS, 10) || 2592000;
    const guest = await createGuestUser(c.env, c.env.DB, {
      ttlSeconds: Math.min(refreshTtl, 7 * 24 * 60 * 60),
    });

    if (!guest) {
      return jsonError(c, 500, 'Unable to create guest session');
    }

    const authUser = mapUserRowToAuthUser(guest);
    const accessToken = await signAccessToken(c.env, authUser);
    const refreshSession = await createRefreshSession(c.env.DB, {
      userId: guest.id,
      ttlSeconds: refreshTtl,
      ipAddress: c.req.header('CF-Connecting-IP') ?? null,
      userAgent: c.req.header('user-agent') ?? null,
    });

    setRefreshCookie(c, refreshSession.plainToken, refreshTtl);

    return jsonSuccess(c, {
      accessToken,
      user: authUser,
    });
  },
);

app.post('/refresh', async (c) => {
  const refreshToken = getCookie(c, refreshCookieName);

  if (!refreshToken) {
    return jsonError(c, 401, 'Refresh token missing');
  }

  const refreshTtl = Number.parseInt(c.env.REFRESH_TOKEN_TTL_SECONDS, 10) || 2592000;
  const session = await rotateRefreshSession(c.env.DB, {
    plainToken: refreshToken,
    ttlSeconds: refreshTtl,
    ipAddress: c.req.header('CF-Connecting-IP') ?? null,
    userAgent: c.req.header('user-agent') ?? null,
  });

  if (!session) {
    deleteCookie(c, refreshCookieName, { path: '/' });
    return jsonError(c, 401, 'Invalid refresh token');
  }

  const user = await findUserById(c.env.DB, session.userId);

  if (!user) {
    deleteCookie(c, refreshCookieName, { path: '/' });
    return jsonError(c, 401, 'Refresh token user no longer exists');
  }

  if (user.status === 'guest' && !(await isGuestSessionValid(c.env, user.id))) {
    deleteCookie(c, refreshCookieName, { path: '/' });
    return jsonError(c, 401, 'Guest session expired');
  }

  const accessToken = await signAccessToken(c.env, mapUserRowToAuthUser(user));
  setRefreshCookie(c, session.plainToken, refreshTtl);

  return jsonSuccess(c, {
    accessToken,
    user: mapUserRowToAuthUser(user),
  });
});

app.post('/logout', async (c) => {
  const refreshToken = getCookie(c, refreshCookieName);

  if (refreshToken) {
    const tokenHash = await hashValue(refreshToken);
    await revokeRefreshToken(c.env.DB, tokenHash);
  }

  deleteCookie(c, refreshCookieName, { path: '/' });

  return jsonSuccess(c, {
    loggedOut: true,
  });
});

app.get('/me', requireAuth, async (c) => {
  const authUser = requireCurrentUser(c);
  const user = await getUserWithProfile(c.env.DB, authUser.id);

  if (!user) {
    return jsonError(c, 404, 'User not found');
  }

  return jsonSuccess(c, user);
});

app.post(
  '/verify-email',
  zValidator('json', verifyEmailSchema),
  async (c) => {
    const payload = c.req.valid('json');
    const verified = await verifyEmailToken(c.env, c.env.DB, payload);

    if (!verified) {
      return jsonError(c, 400, 'Invalid verification token');
    }

    return jsonSuccess(c, {
      verified: true,
    });
  },
);

export default app;
