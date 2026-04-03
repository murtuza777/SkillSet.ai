import type { Context } from 'hono';

export interface AuthUser {
  id: string;
  email: string;
  role: 'user' | 'mentor' | 'admin';
  status: string;
  emailVerifiedAt: string | null;
}

export type ContentQueueMessage =
  | { type: 'ingest_source'; sourceId: string }
  | { type: 'reindex_source'; sourceId: string }
  | { type: 'reindex_skill'; skillId?: string; skillSlug?: string };

export type GamificationQueueMessage =
  | {
      type: 'task_completed';
      userId: string;
      taskId: string;
      attemptId: string;
      idempotencyKey: string;
    }
  | {
      type: 'project_completed';
      userId: string;
      projectId: string;
      idempotencyKey: string;
    }
  | {
      type: 'activity_logged';
      userId: string;
      eventType: string;
      entityType: string;
      entityId: string | null;
    };

export interface AppBindings {
  AI: Ai;
  CACHE: KVNamespace;
  CONTENT_BUCKET: R2Bucket;
  CONTENT_INDEX: Vectorize;
  CONTENT_QUEUE?: Queue<ContentQueueMessage>;
  DB: D1Database;
  GAMIFICATION_QUEUE?: Queue<GamificationQueueMessage>;
  ROOM_HUB: DurableObjectNamespace;
  ACCESS_TOKEN_TTL_SECONDS: string;
  AI_EMBEDDING_MODEL: string;
  AI_TEXT_MODEL: string;
  APP_BASE_URL: string;
  AUTH_RATE_LIMIT_MAX_REQUESTS: string;
  FRONTEND_ORIGIN?: string;
  JWT_SECRET: string;
  RATE_LIMIT_MAX_REQUESTS: string;
  RATE_LIMIT_WINDOW_SECONDS: string;
  REFRESH_TOKEN_TTL_SECONDS: string;
  ROOM_TOKEN_TTL_SECONDS: string;
  YOUTUBE_API_KEY?: string;
}

export interface AppVariables {
  authUser?: AuthUser;
}

export type AppContext = Context<{
  Bindings: AppBindings;
  Variables: AppVariables;
}>;
