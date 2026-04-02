import { allRows, firstRow, placeholders, runStatement } from '../db/client';
import { chunkText, randomId, safeJsonParse, stripHtml } from '../lib/crypto';
import type { AppBindings, ContentQueueMessage } from '../types';
import { embedTexts } from './ai-service';

const curatedDocs: Record<
  string,
  Array<{
    provider: string;
    sourceType: 'doc';
    canonicalUrl: string;
    title: string;
    authorName: string;
    license: string;
    language: string;
    qualityScore: number;
  }>
> = {
  python: [
    {
      provider: 'python_docs',
      sourceType: 'doc',
      canonicalUrl: 'https://docs.python.org/3/tutorial/',
      title: 'Python Tutorial',
      authorName: 'Python Software Foundation',
      license: 'Python Docs License',
      language: 'en',
      qualityScore: 95,
    },
  ],
  react: [
    {
      provider: 'react_docs',
      sourceType: 'doc',
      canonicalUrl: 'https://react.dev/learn',
      title: 'React Learn',
      authorName: 'React Team',
      license: 'React Documentation License',
      language: 'en',
      qualityScore: 96,
    },
  ],
  typescript: [
    {
      provider: 'typescript_docs',
      sourceType: 'doc',
      canonicalUrl: 'https://www.typescriptlang.org/docs/handbook/intro.html',
      title: 'TypeScript Handbook',
      authorName: 'TypeScript Team',
      license: 'Microsoft Docs',
      language: 'en',
      qualityScore: 95,
    },
  ],
};

const cacheKey = (query: string) => `content:discover:${query.toLowerCase().trim()}`;

const getYouTubeResults = async (env: AppBindings, skillName: string) => {
  if (!env.YOUTUBE_API_KEY) {
    return [];
  }

  const url = new URL('https://www.googleapis.com/youtube/v3/search');
  url.searchParams.set('part', 'snippet');
  url.searchParams.set('type', 'video');
  url.searchParams.set('maxResults', '5');
  url.searchParams.set('q', `${skillName} tutorial`);
  url.searchParams.set('key', env.YOUTUBE_API_KEY);

  const response = await fetch(url.toString());
  if (!response.ok) {
    return [];
  }

  const data = (await response.json()) as {
    items?: Array<{
      id?: { videoId?: string };
      snippet?: {
        title?: string;
        channelTitle?: string;
        publishedAt?: string;
        description?: string;
      };
    }>;
  };

  return (data.items ?? [])
    .filter((item) => item.id?.videoId && item.snippet?.title)
    .map((item) => ({
      provider: 'youtube',
      sourceType: 'video' as const,
      canonicalUrl: `https://www.youtube.com/watch?v=${item.id?.videoId}`,
      externalId: item.id?.videoId ?? null,
      title: item.snippet?.title ?? 'Untitled Video',
      authorName: item.snippet?.channelTitle ?? 'YouTube',
      license: 'YouTube Terms',
      language: 'en',
      publishedAt: item.snippet?.publishedAt ?? null,
      qualityScore: 72,
      metadata: {
        description: item.snippet?.description ?? '',
      },
    }));
};

const getSkill = async (
  db: D1Database,
  payload: { skillId?: string; skillSlug?: string; query?: string },
) => {
  if (payload.skillId) {
    const skill = await firstRow<{ id: string; slug: string; name: string }>(
      db,
      `SELECT id, slug, name FROM skills WHERE id = ? LIMIT 1`,
      [payload.skillId],
    );
    if (skill) return skill;
  }

  if (payload.skillSlug) {
    const skill = await firstRow<{ id: string; slug: string; name: string }>(
      db,
      `SELECT id, slug, name FROM skills WHERE slug = ? LIMIT 1`,
      [payload.skillSlug],
    );
    if (skill) return skill;
  }

  if (payload.query) {
    return firstRow<{ id: string; slug: string; name: string }>(
      db,
      `SELECT id, slug, name
       FROM skills
       WHERE LOWER(slug) LIKE LOWER(?)
          OR LOWER(name) LIKE LOWER(?)
       LIMIT 1`,
      [`%${payload.query}%`, `%${payload.query}%`],
    );
  }

  return null;
};

const upsertContentSource = async (
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
  const existing = payload.externalId
    ? await firstRow<{ id: string }>(
        db,
        `SELECT id FROM content_sources WHERE provider = ? AND external_id = ? LIMIT 1`,
        [payload.provider, payload.externalId],
      )
    : await firstRow<{ id: string }>(
        db,
        `SELECT id FROM content_sources WHERE canonical_url = ? LIMIT 1`,
        [payload.canonicalUrl],
      );

  const contentSourceId = existing?.id ?? randomId();
  const params = [
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
    contentSourceId,
  ];

  if (existing) {
    await runStatement(
      db,
      `UPDATE content_sources
       SET source_type = ?, canonical_url = ?, external_id = ?, title = ?, author_name = ?, license = ?, language = ?, published_at = ?, quality_score = ?, metadata_json = ?
       WHERE id = ?`,
      params,
    );
  } else {
    await runStatement(
      db,
      `INSERT INTO content_sources
        (id, provider, source_type, canonical_url, external_id, title, author_name, license, language, published_at, quality_score, metadata_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        contentSourceId,
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
  }

  return contentSourceId;
};

export const discoverContent = async (
  env: AppBindings,
  db: D1Database,
  payload: {
    skillId?: string;
    skillSlug?: string;
    query?: string;
    level?: string;
    goal?: string;
  },
) => {
  const skill = await getSkill(db, payload);
  if (!skill) {
    return { skill: null, sources: [] };
  }

  const key = cacheKey(skill.slug);
  const cached = await env.CACHE.get(key, 'json');
  if (cached && Array.isArray(cached)) {
    return { skill, sources: cached, cached: true };
  }

  const docs = curatedDocs[skill.slug] ?? [];
  const videos = await getYouTubeResults(env, skill.name);
  const discovered = [...docs, ...videos];
  const persistedSources = [];

  for (const source of discovered) {
    const contentSourceId = await upsertContentSource(db, {
      provider: source.provider,
      sourceType: source.sourceType,
      canonicalUrl: source.canonicalUrl,
      externalId: 'externalId' in source ? source.externalId : null,
      title: source.title,
      authorName: source.authorName,
      license: source.license,
      language: source.language,
      publishedAt: 'publishedAt' in source ? source.publishedAt ?? null : null,
      qualityScore: source.qualityScore,
      metadata: {
        ...(source as { metadata?: Record<string, unknown> }).metadata,
        skillId: skill.id,
        skillSlug: skill.slug,
        level: payload.level ?? null,
        goal: payload.goal ?? null,
      },
    });

    await env.CONTENT_BUCKET.put(`sources/${contentSourceId}/discover.json`, JSON.stringify(source, null, 2), {
      httpMetadata: { contentType: 'application/json' },
    });

    await env.CONTENT_QUEUE.send({
      type: 'ingest_source',
      sourceId: contentSourceId,
    });

    persistedSources.push({
      id: contentSourceId,
      ...source,
    });
  }

  await env.CACHE.put(key, JSON.stringify(persistedSources), {
    expirationTtl: 60 * 30,
  });

  return { skill, sources: persistedSources, cached: false };
};

export const getContentSource = async (db: D1Database, sourceId: string) => {
  const source = await firstRow<{
    id: string;
    provider: string;
    source_type: string;
    canonical_url: string;
    external_id: string | null;
    title: string;
    author_name: string | null;
    license: string | null;
    language: string | null;
    published_at: string | null;
    quality_score: number;
    metadata_json: string | null;
  }>(
    db,
    `SELECT
       id,
       provider,
       source_type,
       canonical_url,
       external_id,
       title,
       author_name,
       license,
       language,
       published_at,
       quality_score,
       metadata_json
     FROM content_sources
     WHERE id = ?
     LIMIT 1`,
    [sourceId],
  );

  if (!source) {
    return null;
  }

  const chunks = await allRows<{
    id: string;
    chunk_index: number;
    text: string;
    token_count: number;
    vector_id: string | null;
    keywords_json: string | null;
    summary: string | null;
  }>(
    db,
    `SELECT id, chunk_index, text, token_count, vector_id, keywords_json, summary
     FROM content_chunks
     WHERE content_source_id = ?
     ORDER BY chunk_index ASC`,
    [sourceId],
  );

  return {
    id: source.id,
    provider: source.provider,
    sourceType: source.source_type,
    canonicalUrl: source.canonical_url,
    externalId: source.external_id,
    title: source.title,
    authorName: source.author_name,
    license: source.license,
    language: source.language,
    publishedAt: source.published_at,
    qualityScore: source.quality_score,
    metadata: safeJsonParse(source.metadata_json, {}),
    chunks: chunks.map((chunk) => ({
      id: chunk.id,
      chunkIndex: chunk.chunk_index,
      text: chunk.text,
      tokenCount: chunk.token_count,
      vectorId: chunk.vector_id,
      keywords: safeJsonParse<string[]>(chunk.keywords_json, []),
      summary: chunk.summary,
    })),
  };
};

export const searchContent = async (db: D1Database, query: string) =>
  allRows<{
    id: string;
    title: string;
    canonical_url: string;
    provider: string;
    source_type: string;
    quality_score: number;
  }>(
    db,
    `SELECT DISTINCT cs.id, cs.title, cs.canonical_url, cs.provider, cs.source_type, cs.quality_score
     FROM content_sources cs
     LEFT JOIN content_chunks cc ON cc.content_source_id = cs.id
     WHERE LOWER(cs.title) LIKE LOWER(?)
        OR LOWER(cs.canonical_url) LIKE LOWER(?)
        OR LOWER(COALESCE(cc.text, '')) LIKE LOWER(?)
     ORDER BY cs.quality_score DESC, cs.title ASC
     LIMIT 25`,
    [`%${query}%`, `%${query}%`, `%${query}%`],
  ).then((rows) =>
    rows.map((row) => ({
      id: row.id,
      title: row.title,
      canonicalUrl: row.canonical_url,
      provider: row.provider,
      sourceType: row.source_type,
      qualityScore: row.quality_score,
    })),
  );

const sourceTextFromMetadata = (source: { title: string; metadata_json: string | null }) => {
  const metadata = safeJsonParse<Record<string, unknown>>(source.metadata_json, {});
  const description = typeof metadata.description === 'string' ? metadata.description : '';
  return `${source.title}\n${description}`.trim();
};

export const ingestSourceById = async (env: AppBindings, db: D1Database, sourceId: string) => {
  const source = await firstRow<{
    id: string;
    source_type: string;
    canonical_url: string;
    title: string;
    metadata_json: string | null;
  }>(
    db,
    `SELECT id, source_type, canonical_url, title, metadata_json
     FROM content_sources
     WHERE id = ?
     LIMIT 1`,
    [sourceId],
  );

  if (!source) {
    return null;
  }

  const existingChunkRows = await allRows<{ vector_id: string | null }>(
    db,
    `SELECT vector_id FROM content_chunks WHERE content_source_id = ? AND vector_id IS NOT NULL`,
    [source.id],
  );

  const existingVectorIds = existingChunkRows.map((row) => row.vector_id).filter(Boolean) as string[];
  if (existingVectorIds.length > 0) {
    await env.CONTENT_INDEX.deleteByIds(existingVectorIds);
  }

  let rawPayload = '';
  if (source.source_type === 'doc') {
    const response = await fetch(source.canonical_url);
    rawPayload = response.ok ? await response.text() : sourceTextFromMetadata(source);
  } else {
    rawPayload = sourceTextFromMetadata(source);
  }

  await env.CONTENT_BUCKET.put(`sources/${source.id}/raw.txt`, rawPayload, {
    httpMetadata: { contentType: 'text/plain; charset=utf-8' },
  });

  const cleanText = source.source_type === 'doc' ? stripHtml(rawPayload) : rawPayload;
  const chunks = chunkText(cleanText);
  const embeddings = chunks.length > 0 ? await embedTexts(env, chunks) : [];

  await runStatement(db, `DELETE FROM content_chunks WHERE content_source_id = ?`, [source.id]);

  const vectors: VectorizeVector[] = [];

  for (const [index, chunk] of chunks.entries()) {
    const vectorId = randomId();
    const summary = chunk.slice(0, 180);
    const keywords = Array.from(
      new Set(
        chunk
          .toLowerCase()
          .split(/[^a-z0-9]+/i)
          .filter((word) => word.length > 4)
          .slice(0, 10),
      ),
    );

    await runStatement(
      db,
      `INSERT INTO content_chunks
        (id, content_source_id, chunk_index, text, token_count, vector_id, keywords_json, summary)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        randomId(),
        source.id,
        index,
        chunk,
        chunk.split(/\s+/).length,
        vectorId,
        JSON.stringify(keywords),
        summary,
      ],
    );

    if (embeddings[index]?.length) {
      vectors.push({
        id: vectorId,
        values: embeddings[index],
        metadata: {
          sourceId: source.id,
          chunkIndex: index,
          sourceType: source.source_type,
        },
      });
    }
  }

  if (vectors.length > 0) {
    await env.CONTENT_INDEX.upsert(vectors);
  }

  return {
    sourceId: source.id,
    chunkCount: chunks.length,
  };
};

export const semanticContentLookup = async (
  env: AppBindings,
  db: D1Database,
  payload: {
    skillId?: string;
    skillSlug?: string;
    query: string;
    topK?: number;
  },
) => {
  const [queryEmbedding] = await embedTexts(env, [payload.query]);
  if (!queryEmbedding?.length) {
    return [];
  }

  const matches = await env.CONTENT_INDEX.query(queryEmbedding, {
    topK: payload.topK ?? 8,
    returnMetadata: 'all',
  });

  const vectorIds = matches.matches.map((match) => match.id);
  if (vectorIds.length === 0) {
    return [];
  }

  const rows = await allRows<{
    id: string;
    content_source_id: string;
    chunk_index: number;
    text: string;
    summary: string | null;
    vector_id: string | null;
  }>(
    db,
    `SELECT id, content_source_id, chunk_index, text, summary, vector_id
     FROM content_chunks
     WHERE vector_id IN (${placeholders(vectorIds.length)})`,
    vectorIds,
  );

  const byVectorId = new Map(rows.map((row) => [row.vector_id, row]));

  return matches.matches
    .map((match) => {
      const row = byVectorId.get(match.id);
      if (!row) {
        return null;
      }
      return {
        id: row.id,
        contentSourceId: row.content_source_id,
        chunkIndex: row.chunk_index,
        text: row.text,
        summary: row.summary,
        score: match.score,
      };
    })
    .filter(
      (
        value,
      ): value is {
        id: string;
        contentSourceId: string;
        chunkIndex: number;
        text: string;
        summary: string | null;
        score: number;
      } => value !== null,
    );
};

export const queueReindex = async (env: AppBindings, payload: ContentQueueMessage) => {
  await env.CONTENT_QUEUE.send(payload);
};
