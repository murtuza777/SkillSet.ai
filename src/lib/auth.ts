import { SignJWT, jwtVerify } from 'jose';

import type { AuthUser, AppBindings } from '../types';

const encoder = new TextEncoder();

const getSecret = (env: AppBindings) => encoder.encode(env.JWT_SECRET);

const getAccessTtl = (env: AppBindings) => Number.parseInt(env.ACCESS_TOKEN_TTL_SECONDS, 10) || 900;
const getRoomTtl = (env: AppBindings) => Number.parseInt(env.ROOM_TOKEN_TTL_SECONDS, 10) || 300;

export const signAccessToken = async (env: AppBindings, user: AuthUser) => {
  return new SignJWT({
    email: user.email,
    role: user.role,
    status: user.status,
    emailVerifiedAt: user.emailVerifiedAt,
    type: 'access',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${getAccessTtl(env)}s`)
    .setAudience('skillset-api')
    .sign(getSecret(env));
};

export const verifyAccessToken = async (env: AppBindings, token: string) => {
  const verification = await jwtVerify(token, getSecret(env), {
    audience: 'skillset-api',
  });

  if (verification.payload.type !== 'access') {
    throw new Error('Invalid access token');
  }

  return {
    id: verification.payload.sub as string,
    email: verification.payload.email as string,
    role: verification.payload.role as AuthUser['role'],
    status: verification.payload.status as string,
    emailVerifiedAt: (verification.payload.emailVerifiedAt as string | null) ?? null,
  } satisfies AuthUser;
};

export const signRoomToken = async (
  env: AppBindings,
  payload: { roomId: string; user: AuthUser },
) => {
  return new SignJWT({
    roomId: payload.roomId,
    email: payload.user.email,
    role: payload.user.role,
    type: 'room',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.user.id)
    .setIssuedAt()
    .setExpirationTime(`${getRoomTtl(env)}s`)
    .setAudience('skillset-room')
    .sign(getSecret(env));
};

export const verifyRoomToken = async (env: AppBindings, token: string) => {
  const verification = await jwtVerify(token, getSecret(env), {
    audience: 'skillset-room',
  });

  if (verification.payload.type !== 'room') {
    throw new Error('Invalid room token');
  }

  return {
    userId: verification.payload.sub as string,
    roomId: verification.payload.roomId as string,
    email: verification.payload.email as string,
    role: verification.payload.role as AuthUser['role'],
  };
};
