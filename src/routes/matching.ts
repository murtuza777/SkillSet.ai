import { Hono } from 'hono';

import { jsonError, jsonSuccess } from '../lib/http';
import { requireCurrentUser } from '../lib/session';
import { requireAuth } from '../middleware/auth';
import { getPeerRecommendations, updatePeerMatchStatus } from '../services/matching-service';
import type { AppBindings, AppVariables } from '../types';

const app = new Hono<{
  Bindings: AppBindings;
  Variables: AppVariables;
}>();

app.get('/recommendations', requireAuth, async (c) => {
  const authUser = requireCurrentUser(c);
  const matches = await getPeerRecommendations(c.env.DB, authUser.id);
  return jsonSuccess(c, matches);
});

app.post('/:id/accept', requireAuth, async (c) => {
  const authUser = requireCurrentUser(c);
  const match = await updatePeerMatchStatus(c.env.DB, {
    matchId: c.req.param('id'),
    userId: authUser.id,
    status: 'accepted',
  });

  if (!match) {
    return jsonError(c, 404, 'Match not found');
  }

  return jsonSuccess(c, match);
});

app.post('/:id/reject', requireAuth, async (c) => {
  const authUser = requireCurrentUser(c);
  const match = await updatePeerMatchStatus(c.env.DB, {
    matchId: c.req.param('id'),
    userId: authUser.id,
    status: 'rejected',
  });

  if (!match) {
    return jsonError(c, 404, 'Match not found');
  }

  return jsonSuccess(c, match);
});

export default app;
