import { allRows, firstRow, runStatement } from '../db/client';
import { addSeconds, hashPassword, hashValue, isoNow, randomId, randomToken, verifyPassword } from '../lib/crypto';
import type { AppBindings, AuthUser } from '../types';

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  role: AuthUser['role'];
  status: string;
  email_verified_at: string | null;
  created_at: string;
  updated_at: string;
}

interface ProfileRow {
  user_id: string;
  display_name: string;
  bio: string | null;
  avatar_url: string | null;
  timezone: string | null;
  language: string | null;
  experience_level: string | null;
  weekly_hours: number | null;
}

export const mapUserRowToAuthUser = (user: UserRow): AuthUser => ({
  id: user.id,
  email: user.email,
  role: user.role,
  status: user.status,
  emailVerifiedAt: user.email_verified_at,
});

export const findUserByEmail = async (db: D1Database, email: string) =>
  firstRow<UserRow>(
    db,
    `SELECT id, email, password_hash, role, status, email_verified_at, created_at, updated_at
     FROM users
     WHERE email = ?
     LIMIT 1`,
    [email],
  );

export const findUserById = async (db: D1Database, userId: string) =>
  firstRow<UserRow>(
    db,
    `SELECT id, email, password_hash, role, status, email_verified_at, created_at, updated_at
     FROM users
     WHERE id = ?
     LIMIT 1`,
    [userId],
  );

export const getUserWithProfile = async (db: D1Database, userId: string) => {
  const row = await firstRow<UserRow & ProfileRow>(
    db,
    `SELECT
       u.id,
       u.email,
       u.password_hash,
       u.role,
       u.status,
       u.email_verified_at,
       u.created_at,
       u.updated_at,
       p.user_id,
       p.display_name,
       p.bio,
       p.avatar_url,
       p.timezone,
       p.language,
       p.experience_level,
       p.weekly_hours
     FROM users u
     JOIN profiles p ON p.user_id = u.id
     WHERE u.id = ?
     LIMIT 1`,
    [userId],
  );

  if (!row) {
    return null;
  }

  return {
    user: mapUserRowToAuthUser(row),
    profile: {
      userId: row.user_id,
      displayName: row.display_name,
      bio: row.bio,
      avatarUrl: row.avatar_url,
      timezone: row.timezone,
      language: row.language,
      experienceLevel: row.experience_level,
      weeklyHours: row.weekly_hours,
    },
  };
};

export const createUser = async (
  db: D1Database,
  payload: {
    email: string;
    password: string;
    displayName: string;
    timezone?: string;
    language?: string;
    experienceLevel?: string;
    weeklyHours?: number;
  },
) => {
  const userId = randomId();
  const passwordHash = await hashPassword(payload.password);
  const now = isoNow();

  await runStatement(
    db,
    `INSERT INTO users (id, email, password_hash, role, status, email_verified_at, created_at, updated_at)
     VALUES (?, ?, ?, 'user', 'active', NULL, ?, ?)`,
    [userId, payload.email, passwordHash, now, now],
  );

  await runStatement(
    db,
    `INSERT INTO profiles (
       user_id,
       display_name,
       bio,
       avatar_url,
       timezone,
       language,
       experience_level,
       weekly_hours
     )
     VALUES (?, ?, NULL, NULL, ?, ?, ?, ?)`,
    [
      userId,
      payload.displayName,
      payload.timezone ?? null,
      payload.language ?? null,
      payload.experienceLevel ?? null,
      payload.weeklyHours ?? null,
    ],
  );

  return findUserById(db, userId);
};

export const createGuestUser = async (
  env: AppBindings,
  db: D1Database,
  payload: {
    ttlSeconds: number;
  },
) => {
  const userId = randomId();
  const passwordHash = await hashPassword(randomToken(48));
  const now = isoNow();
  const guestLabel = randomToken(6).slice(0, 8).toUpperCase();

  await runStatement(
    db,
    `INSERT INTO users (id, email, password_hash, role, status, email_verified_at, created_at, updated_at)
     VALUES (?, ?, ?, 'user', 'guest', ?, ?, ?)`,
    [userId, `guest-${userId}@guest.skillset.ai`, passwordHash, now, now, now],
  );

  await runStatement(
    db,
    `INSERT INTO profiles (
       user_id,
       display_name,
       bio,
       avatar_url,
       timezone,
       language,
       experience_level,
       weekly_hours
     )
     VALUES (?, ?, ?, NULL, NULL, 'en', 'beginner', 4)`,
    [userId, `Guest ${guestLabel}`, 'Temporary guest profile'],
  );

  await env.CACHE.put(
    `guest_session:${userId}`,
    JSON.stringify({
      userId,
      expiresAt: addSeconds(payload.ttlSeconds),
    }),
    {
      expirationTtl: payload.ttlSeconds,
    },
  );

  return findUserById(db, userId);
};

export const validateUserPassword = async (user: UserRow, password: string) =>
  verifyPassword(password, user.password_hash);

export const createRefreshSession = async (
  db: D1Database,
  payload: {
    userId: string;
    ttlSeconds: number;
    ipAddress?: string | null;
    userAgent?: string | null;
  },
) => {
  const plainToken = randomToken(48);
  const tokenHash = await hashValue(plainToken);
  const sessionId = randomId();

  await runStatement(
    db,
    `INSERT INTO refresh_tokens
      (id, user_id, token_hash, expires_at, revoked_at, created_at, ip_address, user_agent)
     VALUES (?, ?, ?, ?, NULL, ?, ?, ?)`,
    [
      sessionId,
      payload.userId,
      tokenHash,
      addSeconds(payload.ttlSeconds),
      isoNow(),
      payload.ipAddress ?? null,
      payload.userAgent ?? null,
    ],
  );

  return {
    plainToken,
    sessionId,
    tokenHash,
  };
};

export const revokeRefreshToken = async (db: D1Database, tokenHash: string) => {
  await runStatement(
    db,
    `UPDATE refresh_tokens
     SET revoked_at = ?
     WHERE token_hash = ?
       AND revoked_at IS NULL`,
    [isoNow(), tokenHash],
  );
};

export const rotateRefreshSession = async (
  db: D1Database,
  payload: {
    plainToken: string;
    ttlSeconds: number;
    ipAddress?: string | null;
    userAgent?: string | null;
  },
) => {
  const tokenHash = await hashValue(payload.plainToken);
  const session = await firstRow<{ user_id: string }>(
    db,
    `SELECT user_id
     FROM refresh_tokens
     WHERE token_hash = ?
       AND revoked_at IS NULL
       AND expires_at > ?
     LIMIT 1`,
    [tokenHash, isoNow()],
  );

  if (!session) {
    return null;
  }

  await revokeRefreshToken(db, tokenHash);

  const nextSession = await createRefreshSession(db, {
    userId: session.user_id,
    ttlSeconds: payload.ttlSeconds,
    ipAddress: payload.ipAddress,
    userAgent: payload.userAgent,
  });

  return {
    userId: session.user_id,
    ...nextSession,
  };
};

export const createEmailVerificationToken = async (
  env: AppBindings,
  userId: string,
  email: string,
) => {
  const token = randomToken(32);

  await env.CACHE.put(
    `email_verification:${token}`,
    JSON.stringify({
      userId,
      email,
    }),
    {
      expirationTtl: 60 * 60 * 24,
    },
  );

  return token;
};

export const verifyEmailToken = async (
  env: AppBindings,
  db: D1Database,
  payload: { token: string; email: string },
) => {
  const value = await env.CACHE.get(`email_verification:${payload.token}`);

  if (!value) {
    return false;
  }

  const verification = JSON.parse(value) as { userId: string; email: string };

  if (verification.email !== payload.email) {
    return false;
  }

  await runStatement(
    db,
    `UPDATE users
     SET email_verified_at = ?, updated_at = ?
     WHERE id = ?
       AND email = ?`,
    [isoNow(), isoNow(), verification.userId, verification.email],
  );

  await env.CACHE.delete(`email_verification:${payload.token}`);

  return true;
};

export const isGuestSessionValid = async (env: AppBindings, userId: string) =>
  Boolean(await env.CACHE.get(`guest_session:${userId}`));

export const listUsers = async (db: D1Database) =>
  allRows<UserRow>(
    db,
    `SELECT id, email, password_hash, role, status, email_verified_at, created_at, updated_at
     FROM users
     ORDER BY created_at DESC`,
  );
