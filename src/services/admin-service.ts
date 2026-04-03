import { firstRow, runStatement } from '../db/client';
import { randomId } from '../lib/crypto';
import type { AppBindings } from '../types';
import { queueReindex } from './content-service';

export const getAdminMetrics = async (db: D1Database) => {
  const [users, learningPaths, projects, contentSources, messages] = await Promise.all([
    firstRow<{ total: number }>(db, `SELECT COUNT(*) AS total FROM users`),
    firstRow<{ total: number }>(db, `SELECT COUNT(*) AS total FROM learning_paths`),
    firstRow<{ total: number }>(db, `SELECT COUNT(*) AS total FROM projects`),
    firstRow<{ total: number }>(db, `SELECT COUNT(*) AS total FROM content_sources`),
    firstRow<{ total: number }>(db, `SELECT COUNT(*) AS total FROM messages`),
  ]);

  return {
    totalUsers: users?.total ?? 0,
    totalLearningPaths: learningPaths?.total ?? 0,
    totalProjects: projects?.total ?? 0,
    totalContentSources: contentSources?.total ?? 0,
    totalMessages: messages?.total ?? 0,
  };
};

export const createAdminContentSource = async (
  db: D1Database,
  payload: {
    provider: string;
    sourceType: string;
    canonicalUrl: string;
    externalId?: string | null;
    title: string;
    authorName?: string | null;
    license?: string | null;
    language?: string | null;
    publishedAt?: string | null;
    qualityScore?: number;
    metadata?: Record<string, unknown>;
  },
) => {
  const sourceId = randomId();
  await runStatement(
    db,
    `INSERT INTO content_sources
      (id, provider, source_type, canonical_url, external_id, title, author_name, license, language, published_at, quality_score, metadata_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      sourceId,
      payload.provider,
      payload.sourceType,
      payload.canonicalUrl,
      payload.externalId ?? null,
      payload.title,
      payload.authorName ?? null,
      payload.license ?? null,
      payload.language ?? null,
      payload.publishedAt ?? null,
      payload.qualityScore ?? 0,
      JSON.stringify(payload.metadata ?? {}),
    ],
  );

  return sourceId;
};

export const createBadgeDefinition = async (
  db: D1Database,
  payload: {
    code: string;
    name: string;
    description?: string | null;
    ruleJson?: unknown;
    iconUrl?: string | null;
    rarity?: string | null;
  },
) => {
  const badgeId = randomId();
  await runStatement(
    db,
    `INSERT INTO badge_definitions
      (id, code, name, description, rule_json, icon_url, rarity, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
    [
      badgeId,
      payload.code,
      payload.name,
      payload.description ?? null,
      payload.ruleJson ? JSON.stringify(payload.ruleJson) : null,
      payload.iconUrl ?? null,
      payload.rarity ?? null,
    ],
  );
  return badgeId;
};

export const reindexSkill = async (
  env: AppBindings,
  payload: { skillId?: string; skillSlug?: string },
) => {
  await queueReindex(env, {
    type: 'reindex_skill',
    skillId: payload.skillId,
    skillSlug: payload.skillSlug,
  });
};
