import type { AppContext, AuthUser } from '../types';

export const requireCurrentUser = (c: AppContext): AuthUser => {
  const authUser = c.get('authUser');

  if (!authUser) {
    throw new Error('Authenticated user was not found in request context');
  }

  return authUser;
};
