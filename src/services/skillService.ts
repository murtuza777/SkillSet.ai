import { allRows, firstRow, runStatement } from '../db/client';
import { isoNow, randomId, safeJsonParse } from '../lib/crypto';
import type { AppBindings } from '../types';
import { findUserById } from './auth-service';
import { type DocResource, generateStructuredLearningPath, type LearningPathModule } from './aiService';
import { fetchYoutubeLearningVideos } from './youtubeService';

const DEFAULT_MODULE_BONUS_XP = 25;
const DEFAULT_STREAK_DAILY_BONUS_XP = 5;

const docsCatalog: Record<string, DocResource[]> = {
  react: [
    { title: 'React Learn', url: 'https://react.dev/learn', source: 'react.dev' },
    { title: 'React Reference', url: 'https://react.dev/reference/react', source: 'react.dev' },
  ],
  typescript: [
    {
      title: 'TypeScript Handbook',
      url: 'https://www.typescriptlang.org/docs/handbook/intro.html',
      source: 'typescriptlang.org',
    },
    {
      title: 'TSConfig Reference',
      url: 'https://www.typescriptlang.org/tsconfig',
      source: 'typescriptlang.org',
    },
  ],
  nodejs: [
    { title: 'Node.js Learn', url: 'https://nodejs.org/en/learn', source: 'nodejs.org' },
    { title: 'Node.js API Docs', url: 'https://nodejs.org/api/', source: 'nodejs.org' },
  ],
};

const topicToSlug = (topic: string) =>
  topic
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '')
    .slice(0, 60) || 'skill';

const buildDocsResources = (topic: string) => {
  const key = topic.trim().toLowerCase();
  const staticDocs = docsCatalog[key] ?? [];
  const generatedDocs: DocResource[] = [
    {
      title: `${topic} on MDN`,
      url: `https://developer.mozilla.org/en-US/search?q=${encodeURIComponent(topic)}`,
      source: 'MDN',
    },
    {
      title: `${topic} docs search`,
      url: `https://devdocs.io/#q=${encodeURIComponent(topic)}`,
      source: 'DevDocs',
    },
  ];

  const dedup = new Map<string, DocResource>();
  for (const doc of [...staticDocs, ...generatedDocs]) {
    dedup.set(doc.url, doc);
  }
  return Array.from(dedup.values()).slice(0, 8);
};

const ensureSkill = async (db: D1Database, topic: string) => {
  const existing = await firstRow<{ id: string; slug: string; name: string }>(
    db,
    `SELECT id, slug, name
     FROM skills
     WHERE LOWER(name) = LOWER(?)
        OR LOWER(slug) = LOWER(?)
     LIMIT 1`,
    [topic, topicToSlug(topic)],
  );

  if (existing) {
    return existing;
  }

  const id = randomId();
  const baseSlug = topicToSlug(topic);
  let slug = baseSlug;
  let attempt = 1;

  while (true) {
    const slugRow = await firstRow<{ id: string }>(db, `SELECT id FROM skills WHERE slug = ? LIMIT 1`, [slug]);
    if (!slugRow) {
      break;
    }
    attempt += 1;
    slug = `${baseSlug}-${attempt}`;
  }

  await runStatement(
    db,
    `INSERT INTO skills (id, slug, name, category, description, is_active)
     VALUES (?, ?, ?, 'generated', ?, 1)`,
    [id, slug, topic, `Generated learning track for ${topic}`],
  );

  return { id, slug, name: topic };
};

const ensureUserSkillLink = async (db: D1Database, userId: string, skillId: string) => {
  await runStatement(
    db,
    `INSERT OR IGNORE INTO user_skills
      (id, user_id, skill_id, direction, proficiency_level, target_level, priority)
     VALUES (?, ?, ?, 'want', 'beginner', 'advanced', 1)`,
    [randomId(), userId, skillId],
  );
};

const ensureUserProgressRow = async (db: D1Database, userId: string, skillId: string) => {
  await runStatement(
    db,
    `INSERT OR IGNORE INTO user_progress
      (user_id, skill_id, completed_lessons, xp, streak, last_activity_at, updated_at)
     VALUES (?, ?, 0, 0, 0, NULL, ?)`,
    [userId, skillId, isoNow()],
  );
};

const createLearningPathTree = async (
  db: D1Database,
  payload: {
    skillId: string;
    topic: string;
    modules: LearningPathModule[];
    userId: string;
  },
) => {
  const learningPathId = randomId();
  const estimatedHours = Math.max(1, Math.round((payload.modules.length * 45) / 60));
  const createdAt = isoNow();

  await runStatement(
    db,
    `INSERT INTO learning_paths
      (id, skill_id, title, description, difficulty, goal_type, estimated_hours, source_strategy, version, created_at)
     VALUES (?, ?, ?, ?, 'mixed', 'skill_mastery', ?, 'youtube_docs_plus_ai', 1, ?)`,
    [
      learningPathId,
      payload.skillId,
      `${payload.topic} skill path`,
      `AI-generated learning path for ${payload.topic}`,
      estimatedHours,
      createdAt,
    ],
  );

  let firstModuleId: string | null = null;

  for (const [moduleIndex, module] of payload.modules.entries()) {
    const moduleId = randomId();
    if (moduleIndex === 0) {
      firstModuleId = moduleId;
    }

    await runStatement(
      db,
      `INSERT INTO modules
        (id, learning_path_id, title, summary, sequence_no, estimated_minutes, unlock_rule_json)
       VALUES (?, ?, ?, ?, ?, ?, NULL)`,
      [moduleId, learningPathId, module.title, `${module.title} module`, moduleIndex + 1, 45],
    );

    for (const [lessonIndex, lesson] of module.lessons.entries()) {
      const lessonId = randomId();
      await runStatement(
        db,
        `INSERT INTO lessons
          (id, module_id, title, lesson_type, summary, content_ref_json, sequence_no)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          lessonId,
          moduleId,
          lesson.title,
          lesson.type,
          lesson.task,
          JSON.stringify([
            {
              sourceId: `${moduleId}:${lessonIndex + 1}`,
              type: lesson.type,
              title: lesson.title,
              url: lesson.url,
              canonicalUrl: lesson.url,
              task: lesson.task,
              xp: lesson.xp,
            },
          ]),
          lessonIndex + 1,
        ],
      );

      await runStatement(
        db,
        `INSERT INTO tasks
          (id, module_id, title, task_type, instructions, difficulty, points_reward, acceptance_criteria_json)
         VALUES (?, ?, ?, 'lesson_task', ?, ?, ?, ?)`,
        [
          randomId(),
          moduleId,
          `Task: ${lesson.title}`,
          lesson.task,
          moduleIndex === 0 ? 'beginner' : moduleIndex === 1 ? 'intermediate' : 'advanced',
          lesson.xp,
          JSON.stringify(['Task is completed', 'Outcome is shared']),
        ],
      );
    }
  }

  await runStatement(
    db,
    `INSERT OR IGNORE INTO user_learning_paths
      (id, user_id, learning_path_id, status, progress_pct, started_at, completed_at, current_module_id)
     VALUES (?, ?, ?, 'active', 0, ?, NULL, ?)`,
    [randomId(), payload.userId, learningPathId, createdAt, firstModuleId],
  );

  return { learningPathId };
};

const ensureSquadForSkill = async (
  db: D1Database,
  payload: {
    skillId: string;
    topic: string;
    userId: string;
  },
) => {
  const existingSquad = await firstRow<{ id: string; room_id: string }>(
    db,
    `SELECT s.id, s.room_id
     FROM squads s
     LEFT JOIN squad_members sm ON sm.squad_id = s.id
     WHERE s.skill_id = ?
     GROUP BY s.id, s.room_id, s.created_at
     ORDER BY COUNT(sm.id) ASC, s.created_at ASC
     LIMIT 1`,
    [payload.skillId],
  );

  let squadId = existingSquad?.id ?? null;
  let roomId = existingSquad?.room_id ?? null;

  if (!squadId || !roomId) {
    roomId = randomId();
    squadId = randomId();
    const createdAt = isoNow();

    await runStatement(
      db,
      `INSERT INTO chat_rooms
        (id, room_type, name, related_project_id, related_module_id, created_by, created_at)
       VALUES (?, 'cohort_room', ?, NULL, NULL, ?, ?)`,
      [roomId, `${payload.topic} Squad`, payload.userId, createdAt],
    );

    await runStatement(
      db,
      `INSERT INTO squads (id, skill_id, room_id, created_at)
       VALUES (?, ?, ?, ?)`,
      [squadId, payload.skillId, roomId, createdAt],
    );
  }

  await runStatement(
    db,
    `INSERT OR IGNORE INTO squad_members (id, squad_id, user_id, joined_at)
     VALUES (?, ?, ?, ?)`,
    [randomId(), squadId, payload.userId, isoNow()],
  );

  await runStatement(
    db,
    `INSERT OR IGNORE INTO chat_room_members (id, room_id, user_id, role, joined_at, last_read_message_id)
     VALUES (?, ?, ?, 'member', ?, NULL)`,
    [randomId(), roomId, payload.userId, isoNow()],
  );

  return { squadId, roomId };
};

export const createSkillForUser = async (
  env: AppBindings,
  db: D1Database,
  payload: {
    topic: string;
    userId: string;
    goalType?: string;
    difficulty?: string;
    preferredContentType?: string;
  },
) => {
  const user = await findUserById(db, payload.userId);
  if (!user) {
    return null;
  }

  const topic = payload.topic.trim();
  const skill = await ensureSkill(db, topic);
  await ensureUserSkillLink(db, payload.userId, skill.id);

  const docs = buildDocsResources(topic);
  const youtube = await fetchYoutubeLearningVideos(env, topic);
  const generated = await generateStructuredLearningPath(env, {
    topic,
    videos: youtube.videos,
    docs,
    goalType: payload.goalType,
    difficulty: payload.difficulty,
    preferredContentType: payload.preferredContentType,
  });

  const { learningPathId } = await createLearningPathTree(db, {
    skillId: skill.id,
    topic,
    modules: generated.modules,
    userId: payload.userId,
  });

  await ensureUserProgressRow(db, payload.userId, skill.id);
  const squad = await ensureSquadForSkill(db, {
    skillId: skill.id,
    topic,
    userId: payload.userId,
  });

  return {
    skill: {
      id: skill.id,
      topic: skill.name,
      slug: skill.slug,
      userId: payload.userId,
    },
    learningPathId,
    sources: {
      videos: youtube.videos,
      docs,
    },
    modules: generated.modules,
    squad: {
      id: squad.squadId,
      roomId: squad.roomId,
    },
  };
};

const toDay = (value: string) => value.slice(0, 10);

const daysDiff = (left: string, right: string) => {
  const leftValue = Date.parse(`${toDay(left)}T00:00:00.000Z`);
  const rightValue = Date.parse(`${toDay(right)}T00:00:00.000Z`);
  return Math.round((leftValue - rightValue) / (24 * 60 * 60 * 1000));
};

export const getUserSkillProgress = async (db: D1Database, userId: string, skillId: string) => {
  const progress = await firstRow<{
    completed_lessons: number;
    xp: number;
    streak: number;
    last_activity_at: string | null;
    updated_at: string | null;
  }>(
    db,
    `SELECT completed_lessons, xp, streak, last_activity_at, updated_at
     FROM user_progress
     WHERE user_id = ?
       AND skill_id = ?
     LIMIT 1`,
    [userId, skillId],
  );

  const totals = await firstRow<{ total_lessons: number; total_modules: number }>(
    db,
    `SELECT
       COUNT(DISTINCT l.id) AS total_lessons,
       COUNT(DISTINCT m.id) AS total_modules
     FROM learning_paths lp
     JOIN modules m ON m.learning_path_id = lp.id
     LEFT JOIN lessons l ON l.module_id = m.id
     WHERE lp.skill_id = ?`,
    [skillId],
  );

  return {
    userId,
    skillId,
    completedLessons: progress?.completed_lessons ?? 0,
    totalLessons: totals?.total_lessons ?? 0,
    totalModules: totals?.total_modules ?? 0,
    xp: progress?.xp ?? 0,
    streak: progress?.streak ?? 0,
    lastActivityAt: progress?.last_activity_at ?? null,
    updatedAt: progress?.updated_at ?? null,
  };
};

export const completeSkillLesson = async (
  db: D1Database,
  payload: {
    userId: string;
    lessonId: string;
  },
) => {
  const lesson = await firstRow<{
    id: string;
    module_id: string;
    content_ref_json: string | null;
    skill_id: string;
  }>(
    db,
    `SELECT l.id, l.module_id, l.content_ref_json, lp.skill_id
     FROM lessons l
     JOIN modules m ON m.id = l.module_id
     JOIN learning_paths lp ON lp.id = m.learning_path_id
     WHERE l.id = ?
     LIMIT 1`,
    [payload.lessonId],
  );

  if (!lesson) {
    return null;
  }

  await ensureUserProgressRow(db, payload.userId, lesson.skill_id);

  const completionResult = await runStatement(
    db,
    `INSERT OR IGNORE INTO user_completed_lessons (user_id, lesson_id, skill_id, completed_at)
     VALUES (?, ?, ?, ?)`,
    [payload.userId, lesson.id, lesson.skill_id, isoNow()],
  );

  const wasInserted = (completionResult.meta?.changes ?? 0) > 0;
  const progressBefore = await firstRow<{
    completed_lessons: number;
    xp: number;
    streak: number;
    last_activity_at: string | null;
  }>(
    db,
    `SELECT completed_lessons, xp, streak, last_activity_at
     FROM user_progress
     WHERE user_id = ?
       AND skill_id = ?
     LIMIT 1`,
    [payload.userId, lesson.skill_id],
  );

  if (!wasInserted) {
    return {
      alreadyCompleted: true,
      xpAwarded: 0,
      moduleBonusXp: 0,
      streakBonusXp: 0,
      progress: await getUserSkillProgress(db, payload.userId, lesson.skill_id),
    };
  }

  const contentRefs = safeJsonParse<Array<{ xp?: number }>>(lesson.content_ref_json, []);
  const lessonXp = Number.isFinite(contentRefs[0]?.xp) ? Math.max(5, Math.round(contentRefs[0]!.xp!)) : 10;

  const moduleTotals = await firstRow<{ total_lessons: number; completed_lessons: number }>(
    db,
    `SELECT
       COUNT(l.id) AS total_lessons,
       (
         SELECT COUNT(*)
         FROM user_completed_lessons ucl
         JOIN lessons l2 ON l2.id = ucl.lesson_id
         WHERE ucl.user_id = ?
           AND l2.module_id = ?
       ) AS completed_lessons
     FROM lessons l
     WHERE l.module_id = ?`,
    [payload.userId, lesson.module_id, lesson.module_id],
  );

  const moduleCompleted =
    Boolean(moduleTotals) &&
    (moduleTotals?.total_lessons ?? 0) > 0 &&
    moduleTotals?.completed_lessons === moduleTotals?.total_lessons;
  const moduleBonusXp = moduleCompleted ? DEFAULT_MODULE_BONUS_XP : 0;

  const now = isoNow();
  const previousActivity = progressBefore?.last_activity_at;
  const previousStreak = progressBefore?.streak ?? 0;
  const dayDifference = previousActivity ? daysDiff(now, previousActivity) : Number.NaN;
  const isNewDay = !previousActivity || dayDifference >= 1;
  let nextStreak = previousStreak;

  if (!previousActivity) {
    nextStreak = 1;
  } else if (dayDifference === 1) {
    nextStreak = previousStreak + 1;
  } else if (dayDifference > 1) {
    nextStreak = 1;
  }

  const streakBonusXp = isNewDay && nextStreak >= 2 ? DEFAULT_STREAK_DAILY_BONUS_XP : 0;
  const xpAwarded = lessonXp + moduleBonusXp + streakBonusXp;

  await runStatement(
    db,
    `UPDATE user_progress
     SET completed_lessons = completed_lessons + 1,
         xp = xp + ?,
         streak = ?,
         last_activity_at = ?,
         updated_at = ?
     WHERE user_id = ?
       AND skill_id = ?`,
    [xpAwarded, nextStreak, now, now, payload.userId, lesson.skill_id],
  );

  await runStatement(
    db,
    `INSERT INTO xp_logs (id, user_id, skill_id, lesson_id, reason, xp_delta, created_at)
     VALUES (?, ?, ?, ?, 'lesson_completed', ?, ?)`,
    [randomId(), payload.userId, lesson.skill_id, lesson.id, lessonXp, now],
  );

  if (moduleBonusXp > 0) {
    await runStatement(
      db,
      `INSERT INTO xp_logs (id, user_id, skill_id, lesson_id, reason, xp_delta, created_at)
       VALUES (?, ?, ?, ?, 'module_completed_bonus', ?, ?)`,
      [randomId(), payload.userId, lesson.skill_id, lesson.id, moduleBonusXp, now],
    );
  }

  if (streakBonusXp > 0) {
    await runStatement(
      db,
      `INSERT INTO xp_logs (id, user_id, skill_id, lesson_id, reason, xp_delta, created_at)
       VALUES (?, ?, ?, ?, 'daily_streak_bonus', ?, ?)`,
      [randomId(), payload.userId, lesson.skill_id, lesson.id, streakBonusXp, now],
    );
  }

  return {
    alreadyCompleted: false,
    xpAwarded,
    moduleBonusXp,
    streakBonusXp,
    progress: await getUserSkillProgress(db, payload.userId, lesson.skill_id),
  };
};

export const getUserSkillXpLogs = async (db: D1Database, userId: string, skillId: string) =>
  allRows<{
    id: string;
    lesson_id: string | null;
    reason: string;
    xp_delta: number;
    created_at: string;
  }>(
    db,
    `SELECT id, lesson_id, reason, xp_delta, created_at
     FROM xp_logs
     WHERE user_id = ?
       AND skill_id = ?
     ORDER BY created_at DESC
     LIMIT 100`,
    [userId, skillId],
  ).then((rows) =>
    rows.map((row) => ({
      id: row.id,
      lessonId: row.lesson_id,
      reason: row.reason,
      xpDelta: row.xp_delta,
      createdAt: row.created_at,
    })),
  );
