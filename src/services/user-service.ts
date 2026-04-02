import { allRows, firstRow, runStatement } from '../db/client';
import { randomId, safeJsonParse } from '../lib/crypto';

export const updateProfile = async (
  db: D1Database,
  userId: string,
  payload: {
    displayName?: string;
    bio?: string | null;
    avatarUrl?: string | null;
    timezone?: string | null;
    language?: string | null;
    experienceLevel?: string | null;
    weeklyHours?: number | null;
  },
) => {
  const existing = await firstRow<{
    display_name: string;
    bio: string | null;
    avatar_url: string | null;
    timezone: string | null;
    language: string | null;
    experience_level: string | null;
    weekly_hours: number | null;
  }>(
    db,
    `SELECT display_name, bio, avatar_url, timezone, language, experience_level, weekly_hours
     FROM profiles
     WHERE user_id = ?
     LIMIT 1`,
    [userId],
  );

  if (!existing) {
    return;
  }

  await runStatement(
    db,
    `UPDATE profiles
     SET display_name = ?, bio = ?, avatar_url = ?, timezone = ?, language = ?, experience_level = ?, weekly_hours = ?
     WHERE user_id = ?`,
    [
      payload.displayName ?? existing.display_name,
      payload.bio ?? existing.bio,
      payload.avatarUrl ?? existing.avatar_url,
      payload.timezone ?? existing.timezone,
      payload.language ?? existing.language,
      payload.experienceLevel ?? existing.experience_level,
      payload.weeklyHours ?? existing.weekly_hours,
      userId,
    ],
  );
};

export const getPublicProfile = async (db: D1Database, userId: string) => {
  const profile = await firstRow<{
    user_id: string;
    display_name: string;
    bio: string | null;
    avatar_url: string | null;
    timezone: string | null;
    language: string | null;
    experience_level: string | null;
    weekly_hours: number | null;
  }>(
    db,
    `SELECT user_id, display_name, bio, avatar_url, timezone, language, experience_level, weekly_hours
     FROM profiles
     WHERE user_id = ?
     LIMIT 1`,
    [userId],
  );

  if (!profile) {
    return null;
  }

  const skills = await allRows<{
    id: string;
    slug: string;
    name: string;
    direction: string;
    proficiency_level: string | null;
    target_level: string | null;
    priority: number | null;
  }>(
    db,
    `SELECT
       s.id,
       s.slug,
       s.name,
       us.direction,
       us.proficiency_level,
       us.target_level,
       us.priority
     FROM user_skills us
     JOIN skills s ON s.id = us.skill_id
     WHERE us.user_id = ?
     ORDER BY us.direction ASC, us.priority DESC, s.name ASC`,
    [userId],
  );

  return {
    userId: profile.user_id,
    displayName: profile.display_name,
    bio: profile.bio,
    avatarUrl: profile.avatar_url,
    timezone: profile.timezone,
    language: profile.language,
    experienceLevel: profile.experience_level,
    weeklyHours: profile.weekly_hours,
    skills: skills.map((skill) => ({
      id: skill.id,
      slug: skill.slug,
      name: skill.name,
      direction: skill.direction,
      proficiencyLevel: skill.proficiency_level,
      targetLevel: skill.target_level,
      priority: skill.priority,
    })),
  };
};

export const replaceUserSkills = async (
  db: D1Database,
  userId: string,
  skills: Array<{
    skillId: string;
    direction: 'have' | 'want';
    proficiencyLevel?: string | null;
    targetLevel?: string | null;
    priority?: number | null;
  }>,
) => {
  await runStatement(db, `DELETE FROM user_skills WHERE user_id = ?`, [userId]);

  for (const skill of skills) {
    await runStatement(
      db,
      `INSERT INTO user_skills
        (id, user_id, skill_id, direction, proficiency_level, target_level, priority)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        randomId(),
        userId,
        skill.skillId,
        skill.direction,
        skill.proficiencyLevel ?? null,
        skill.targetLevel ?? null,
        skill.priority ?? null,
      ],
    );
  }
};

export const getUserActivity = async (db: D1Database, userId: string) => {
  const rows = await allRows<{
    id: string;
    event_type: string;
    entity_type: string;
    entity_id: string | null;
    metadata_json: string | null;
    created_at: string;
  }>(
    db,
    `SELECT id, event_type, entity_type, entity_id, metadata_json, created_at
     FROM activity_logs
     WHERE user_id = ?
     ORDER BY created_at DESC
     LIMIT 50`,
    [userId],
  );

  return rows.map((row) => ({
    id: row.id,
    eventType: row.event_type,
    entityType: row.entity_type,
    entityId: row.entity_id,
    metadata: safeJsonParse(row.metadata_json, null),
    createdAt: row.created_at,
  }));
};
