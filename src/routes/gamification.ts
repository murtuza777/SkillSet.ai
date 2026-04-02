import { Hono } from 'hono';

import { jsonSuccess } from '../lib/http';
import { requireCurrentUser } from '../lib/session';
import { requireAuth } from '../middleware/auth';
import { getGamificationOverview, getLeaderboard } from '../services/gamification-service';
import type { AppBindings, AppVariables } from '../types';

const app = new Hono<{
  Bindings: AppBindings;
  Variables: AppVariables;
}>();

app.get('/gamification/me', requireAuth, async (c) => {
  const authUser = requireCurrentUser(c);
  const overview = await getGamificationOverview(c.env.DB, authUser.id);
  return jsonSuccess(c, overview);
});

app.get('/badges', requireAuth, async (c) => {
  const authUser = requireCurrentUser(c);
  const db = c.env.DB;
  const badges = await db.prepare(`
    SELECT
      bd.id,
      bd.code,
      bd.name,
      bd.description,
      bd.icon_url,
      bd.rarity,
      bd.is_active,
      EXISTS (
        SELECT 1
        FROM user_badges ub
        WHERE ub.badge_id = bd.id
          AND ub.user_id = ?
      ) AS awarded
    FROM badge_definitions bd
    WHERE bd.is_active = 1
    ORDER BY bd.name ASC
  `).bind(authUser.id).all<{
    id: string;
    code: string;
    name: string;
    description: string | null;
    icon_url: string | null;
    rarity: string | null;
    is_active: boolean;
    awarded: number;
  }>();

  return jsonSuccess(
    c,
    (badges.results ?? []).map((badge) => ({
      id: badge.id,
      code: badge.code,
      name: badge.name,
      description: badge.description,
      iconUrl: badge.icon_url,
      rarity: badge.rarity,
      isActive: Boolean(badge.is_active),
      awarded: Boolean(badge.awarded),
    })),
  );
});

app.get('/leaderboards', async (c) => {
  const leaderboard = await getLeaderboard(c.env.DB, {
    scopeType: c.req.query('scopeType') ?? 'global',
    scopeId: c.req.query('scopeId') ?? null,
    periodType: c.req.query('periodType') ?? 'all_time',
  });

  return jsonSuccess(c, leaderboard);
});

app.get('/leaderboards/:scope', async (c) => {
  const leaderboard = await getLeaderboard(c.env.DB, {
    scopeType: c.req.param('scope'),
    scopeId: c.req.query('scopeId') ?? null,
    periodType: c.req.query('periodType') ?? 'all_time',
  });

  return jsonSuccess(c, leaderboard);
});

export default app;
