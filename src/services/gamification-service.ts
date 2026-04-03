import { allRows, firstRow, runStatement } from '../db/client';
import { isoNow, randomId, safeJsonParse } from '../lib/crypto';
import type { AppBindings, GamificationQueueMessage } from '../types';

export const logActivity = async (
  db: D1Database,
  payload: {
    userId: string;
    eventType: string;
    entityType: string;
    entityId: string | null;
    metadata?: unknown;
  },
) => {
  await runStatement(
    db,
    `INSERT INTO activity_logs (id, user_id, event_type, entity_type, entity_id, metadata_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      randomId(),
      payload.userId,
      payload.eventType,
      payload.entityType,
      payload.entityId,
      payload.metadata ? JSON.stringify(payload.metadata) : null,
      isoNow(),
    ],
  );
};

export const enqueueGamificationEvent = async (env: AppBindings, message: GamificationQueueMessage) => {
  await env.GAMIFICATION_QUEUE.send(message);
};

const getDailyActivityStreak = async (db: D1Database, userId: string) => {
  const rows = await allRows<{ activity_day: string }>(
    db,
    `SELECT DISTINCT substr(created_at, 1, 10) AS activity_day
     FROM activity_logs
     WHERE user_id = ?
     ORDER BY activity_day ASC`,
    [userId],
  );

  let longestStreak = 0;
  let currentStreak = 0;
  let previousDay: number | null = null;

  for (const row of rows) {
    const dayValue = Date.parse(`${row.activity_day}T00:00:00.000Z`);

    if (!Number.isFinite(dayValue)) {
      continue;
    }

    if (previousDay === null || dayValue - previousDay === 24 * 60 * 60 * 1000) {
      currentStreak += 1;
    } else {
      currentStreak = 1;
    }

    previousDay = dayValue;
    longestStreak = Math.max(longestStreak, currentStreak);
  }

  return longestStreak;
};

const awardPoints = async (
  db: D1Database,
  payload: {
    userId: string;
    eventType: string;
    pointsDelta: number;
    sourceEntity: string;
    sourceId: string;
    idempotencyKey: string;
  },
) => {
  await runStatement(
    db,
    `INSERT OR IGNORE INTO point_ledger
      (id, user_id, event_type, points_delta, source_entity, source_id, idempotency_key, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      randomId(),
      payload.userId,
      payload.eventType,
      payload.pointsDelta,
      payload.sourceEntity,
      payload.sourceId,
      payload.idempotencyKey,
      isoNow(),
    ],
  );
};

const evaluateBadges = async (db: D1Database, userId: string) => {
  const badgeRows = await allRows<{
    id: string;
    code: string;
    rule_json: string | null;
  }>(
    db,
    `SELECT id, code, rule_json
     FROM badge_definitions
     WHERE is_active = 1`,
  );

  for (const badge of badgeRows) {
    const rule = safeJsonParse<{ event?: string; count?: number }>(badge.rule_json, {});
    const requiredCount = rule.count ?? 1;

    if (!rule.event) {
      continue;
    }

    const total =
      rule.event === 'daily_streak'
        ? await getDailyActivityStreak(db, userId)
        : (await firstRow<{ total: number }>(
            db,
            `SELECT COUNT(*) AS total
             FROM activity_logs
             WHERE user_id = ?
               AND event_type = ?`,
            [userId, rule.event],
          ))?.total ?? 0;

    if (total < requiredCount) {
      continue;
    }

    await runStatement(
      db,
      `INSERT OR IGNORE INTO user_badges (id, user_id, badge_id, awarded_at)
       VALUES (?, ?, ?, ?)`,
      [randomId(), userId, badge.id, isoNow()],
    );
  }
};

export const processGamificationQueueMessage = async (
  db: D1Database,
  message: GamificationQueueMessage,
) => {
  if (message.type === 'task_completed') {
    const task = await firstRow<{ points_reward: number }>(
      db,
      `SELECT points_reward FROM tasks WHERE id = ? LIMIT 1`,
      [message.taskId],
    );

    await awardPoints(db, {
      userId: message.userId,
      eventType: 'task_completed',
      pointsDelta: task?.points_reward ?? 10,
      sourceEntity: 'task',
      sourceId: message.taskId,
      idempotencyKey: message.idempotencyKey,
    });

    await evaluateBadges(db, message.userId);
    return;
  }

  if (message.type === 'project_completed') {
    await awardPoints(db, {
      userId: message.userId,
      eventType: 'project_completed',
      pointsDelta: 100,
      sourceEntity: 'project',
      sourceId: message.projectId,
      idempotencyKey: message.idempotencyKey,
    });

    await evaluateBadges(db, message.userId);
    return;
  }

  if (message.type === 'activity_logged') {
    await evaluateBadges(db, message.userId);
  }
};

export const getGamificationOverview = async (db: D1Database, userId: string) => {
  const pointsRow = await firstRow<{ total_points: number }>(
    db,
    `SELECT COALESCE(SUM(points_delta), 0) AS total_points
     FROM point_ledger
     WHERE user_id = ?`,
    [userId],
  );

  const levelRow = await firstRow<{ level_no: number; title: string; min_points: number }>(
    db,
    `SELECT level_no, title, min_points
     FROM level_definitions
     WHERE min_points <= ?
     ORDER BY min_points DESC
     LIMIT 1`,
    [pointsRow?.total_points ?? 0],
  );

  const badges = await allRows<{
    id: string;
    code: string;
    name: string;
    description: string | null;
    icon_url: string | null;
    rarity: string | null;
    awarded_at: string;
  }>(
    db,
    `SELECT
       bd.id,
       bd.code,
       bd.name,
       bd.description,
       bd.icon_url,
       bd.rarity,
       ub.awarded_at
     FROM user_badges ub
     JOIN badge_definitions bd ON bd.id = ub.badge_id
     WHERE ub.user_id = ?
     ORDER BY ub.awarded_at DESC`,
    [userId],
  );

  const recentEntries = await allRows<{
    id: string;
    event_type: string;
    points_delta: number;
    source_entity: string | null;
    source_id: string | null;
    created_at: string;
  }>(
    db,
    `SELECT id, event_type, points_delta, source_entity, source_id, created_at
     FROM point_ledger
     WHERE user_id = ?
     ORDER BY created_at DESC
     LIMIT 20`,
    [userId],
  );

  return {
    totalPoints: pointsRow?.total_points ?? 0,
    level: levelRow
      ? {
          levelNo: levelRow.level_no,
          title: levelRow.title,
          minPoints: levelRow.min_points,
        }
      : null,
    badges: badges.map((badge) => ({
      id: badge.id,
      code: badge.code,
      name: badge.name,
      description: badge.description,
      iconUrl: badge.icon_url,
      rarity: badge.rarity,
      awardedAt: badge.awarded_at,
    })),
    recentEntries: recentEntries.map((entry) => ({
      id: entry.id,
      eventType: entry.event_type,
      pointsDelta: entry.points_delta,
      sourceEntity: entry.source_entity,
      sourceId: entry.source_id,
      createdAt: entry.created_at,
    })),
  };
};

export const getLeaderboard = async (
  db: D1Database,
  payload: {
    scopeType?: string;
    scopeId?: string | null;
    periodType?: string;
  },
) => {
  const scopeType = payload.scopeType ?? 'global';
  const periodType = payload.periodType ?? 'all_time';
  const scopedUsersJoin =
    scopeType === 'skill' && payload.scopeId
      ? `JOIN (
           SELECT DISTINCT user_id
           FROM user_skills
           WHERE skill_id = ?
         ) scoped_users ON scoped_users.user_id = pl.user_id`
      : scopeType === 'cohort' && payload.scopeId
        ? `JOIN (
             SELECT DISTINCT crm.user_id
             FROM chat_room_members crm
             JOIN chat_rooms cr ON cr.id = crm.room_id
             WHERE cr.id = ?
               AND cr.room_type = 'cohort_room'
           ) scoped_users ON scoped_users.user_id = pl.user_id`
        : '';
  const params: string[] = [];
  const periodFilters: string[] = [];

  if (payload.scopeId && scopeType !== 'global') {
    params.push(payload.scopeId);
  }

  if (periodType === 'weekly') {
    periodFilters.push('pl.created_at >= ?');
    params.push(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());
  }

  const whereClause = periodFilters.length > 0 ? `WHERE ${periodFilters.join(' AND ')}` : '';

  const rankingRows = await allRows<{
    user_id: string;
    display_name: string;
    avatar_url: string | null;
    total_points: number;
  }>(
    db,
    `SELECT
       pl.user_id,
       p.display_name,
       p.avatar_url,
       COALESCE(SUM(pl.points_delta), 0) AS total_points
     FROM point_ledger pl
     ${scopedUsersJoin}
     JOIN profiles p ON p.user_id = pl.user_id
     ${whereClause}
     GROUP BY pl.user_id, p.display_name, p.avatar_url
     ORDER BY total_points DESC, p.display_name ASC
     LIMIT 50`,
    params,
  );

  const rankings = rankingRows.map((row, index) => ({
    rank: index + 1,
    userId: row.user_id,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    totalPoints: row.total_points,
  }));

  await runStatement(
    db,
    `INSERT INTO leaderboard_snapshots
      (id, board_type, scope_type, scope_id, period_type, rankings_json, generated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [randomId(), 'points', scopeType, payload.scopeId ?? null, periodType, JSON.stringify(rankings), isoNow()],
  );

  return {
    scopeType,
    scopeId: payload.scopeId ?? null,
    periodType,
    rankings,
  };
};
