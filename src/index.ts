import { Hono } from 'hono';
import { cors } from 'hono/cors';

import apiChatRoutes from './api/chat';
import apiSkillsRoutes from './api/skills';
import { RoomHub } from './durable/room-hub';
import { jsonError, jsonSuccess } from './lib/http';
import adminRoutes from './routes/admin';
import authRoutes from './routes/auth';
import chatRoutes from './routes/chat';
import contentRoutes from './routes/content';
import gamificationRoutes from './routes/gamification';
import learningRoutes from './routes/learning';
import matchingRoutes from './routes/matching';
import projectsRoutes from './routes/projects';
import skillsRoutes from './routes/skills';
import usersRoutes from './routes/users';
import { discoverContent, ingestSourceById } from './services/content-service';
import { processGamificationQueueMessage } from './services/gamification-service';
import type { AppBindings, AppVariables, ContentQueueMessage, GamificationQueueMessage } from './types';

const app = new Hono<{
  Bindings: AppBindings;
  Variables: AppVariables;
}>();

const getAllowedOrigins = (env: AppBindings) =>
  (env.FRONTEND_ORIGIN ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

app.use(
  '*',
  cors({
    origin: (origin, c) => {
      const allowedOrigins = getAllowedOrigins(c.env);

      if (!origin) {
        return allowedOrigins[0] ?? '*';
      }

      if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        return origin;
      }

      return null;
    },
    allowHeaders: ['Authorization', 'Content-Type', 'X-Requested-With'],
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  }),
);

app.get('/', (c) =>
  jsonSuccess(c, {
    service: 'skillset-ai-api',
    status: 'ok',
  }),
);

app.get('/ws/rooms/:roomId', async (c) => {
  const roomId = c.req.param('roomId');
  const stub = c.env.ROOM_HUB.get(c.env.ROOM_HUB.idFromName(roomId));
  return stub.fetch(c.req.raw);
});

app.route('/auth', authRoutes);
app.route('/users', usersRoutes);
app.route('/skills', skillsRoutes);
app.route('/api/skills', apiSkillsRoutes);
app.route('/content', contentRoutes);
app.route('/', learningRoutes);
app.route('/projects', projectsRoutes);
app.route('/matches', matchingRoutes);
app.route('/api/chat', apiChatRoutes);
app.route('/', chatRoutes);
app.route('/', gamificationRoutes);
app.route('/admin', adminRoutes);

app.notFound((c) => jsonError(c, 404, 'Route not found'));
app.onError((error, c) => {
  console.error(error);
  return jsonError(c, 500, 'Internal server error', error.message);
});

const processContentQueueMessage = async (env: AppBindings, body: ContentQueueMessage) => {
  if (body.type === 'ingest_source' || body.type === 'reindex_source') {
    await ingestSourceById(env, env.DB, body.sourceId);
    return;
  }

  if (body.type === 'reindex_skill') {
    const discovery = await discoverContent(env, env.DB, {
      skillId: body.skillId,
      skillSlug: body.skillSlug,
    });

    for (const source of discovery.sources) {
      await ingestSourceById(env, env.DB, source.id);
    }
  }
};

const processGamificationMessage = async (env: AppBindings, body: GamificationQueueMessage) => {
  await processGamificationQueueMessage(env.DB, body);
};

export default {
  fetch: app.fetch,
  async queue(batch, env) {
    for (const message of batch.messages) {
      try {
        const body = message.body as ContentQueueMessage | GamificationQueueMessage;

        if (
          body.type === 'ingest_source' ||
          body.type === 'reindex_source' ||
          body.type === 'reindex_skill'
        ) {
          await processContentQueueMessage(env, body);
        } else {
          await processGamificationMessage(env, body);
        }
      } catch (error) {
        console.error('Queue message failed', error);
        message.retry();
      }
    }
  },
} satisfies ExportedHandler<AppBindings>;

export { RoomHub };
